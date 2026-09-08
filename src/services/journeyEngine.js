import * as ncJourneyMasterModel from '../models/ncJourneyMasterModel.js'
import * as ncJourneyNodesModel from '../models/ncJourneyNodesModel.js'
import * as ncJourneyTrackerModel from '../models/ncJourneyTrackerModel.js'
import * as ncJourneyTrackLogModel from '../models/ncJourneyTrackLogModel.js'
import * as messagesModel from '../models/messagesModel.js'
import { refreshAiSensyTokenIfNeeded } from '../vendors/aisensyToken.js'

// Common named entities (&#039; is the one the original PHP explicitly calls out)
// plus numeric character references — the WhatsApp-side rendering wants the real
// character, not the journey-builder UI's escaped one.
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#039': "'" }
function decodeHtmlEntities(text) {
  if (!text) return text
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (match, code) => {
    if (code[0] === '#') {
      const codePoint = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}

// Matches legacy's `str_replace(["\r\n","\r","\n"], "\\r\\n", ...)` — real newlines
// become the literal two-character sequence \r\n in the stored message text, exactly
// as the CRM's own message-log column has always displayed automated-node sends.
function escapeNewlinesForStorage(text) {
  return text.replace(/\r\n|\r|\n/g, '\\r\\n')
}

async function sendAiSensyRaw({ employee, payload }) {
  const freshEmployee = await refreshAiSensyTokenIfNeeded(employee)
  const response = await fetch('https://backend.aisensy.com/direct-apis/t1/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshEmployee.whatsappApiUsername}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  return data?.messages?.[0]?.id || null
}

/** Sends one journey node's message and returns {sourceId, dbText} for the outbound message row — null sourceId if the vendor send failed. */
async function sendJourneyNode({ employee, node, clientMobile }) {
  if (node.nodeElementType === '2') {
    const parsed = JSON.parse(node.nodeMessageJson)
    const nodeTextMsg = decodeHtmlEntities(parsed.node_text_msg)
    const listItems = Array.isArray(parsed.list_item) ? parsed.list_item : []

    const payload = {
      recipient_type: 'Individual',
      to: clientMobile,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: nodeTextMsg },
        action: {
          button: parsed.node_list_msg,
          sections: [{ title: 'Menu Items', rows: listItems.map((title, index) => ({ id: `text_${index}`, title })) }],
        },
      },
    }

    const combinedMessage = `${parsed.node_text_msg}\n${parsed.node_list_msg}\nOptions: ${listItems.join(', ')}`
    const dbText = combinedMessage.replace(/\n/g, '<br/>')
    const sourceId = await sendAiSensyRaw({ employee, payload })
    return { sourceId, dbText }
  }

  const decodedText = decodeHtmlEntities(node.nodeMessageJson)
  const payload = { to: clientMobile, type: 'text', recipient_type: 'Individual', text: { body: decodedText } }
  const sourceId = await sendAiSensyRaw({ employee, payload })
  return { sourceId, dbText: escapeNewlinesForStorage(node.nodeMessageJson) }
}

/**
 * Sends `startNode` and every subsequent auto-continue (node_element_type='0') node
 * in its chain, stopping (and logging) at the first interactive-list node ('2'),
 * which waits for the client's reply. A clean loop replacing legacy's several levels
 * of manually copy-pasted "send node, then also fetch+send the next one" blocks —
 * mechanically identical behavior, without the transcription risk of hand-unrolling
 * that many repeated blocks.
 */
async function advanceJourney({ employee, trackId, journeyId, clientMobile, clientName, jrId, userAdminId, wabaNumber, startNode }) {
  let node = startNode
  while (node) {
    const { sourceId, dbText } = await sendJourneyNode({ employee, node, clientMobile })
    if (sourceId) {
      await messagesModel.insertMessage({
        response: 'Sent From Agent',
        name: clientName,
        mobile: clientMobile,
        type: 'T',
        text: dbText,
        waNumber: wabaNumber,
        sourceId,
        sendBy: jrId,
        userAdminId,
        msgtype: 'S',
        status: 'Y',
        recvDate: new Date(),
        vendorType: 'A',
        autoMessage: 'Y',
      })
    }
    await ncJourneyTrackLogModel.insertLog({ trackId, nodeId: node.nodeSlno })

    node = node.nodeElementType === '0' ? await ncJourneyNodesModel.findNextByParent({ journeyId, parentId: node.nodeSlno }) : null
  }
}

/** Resolves which node comes next after a reply, per the last node the client was left at — exactly whatsapp_aisense_response.php ~lines 1035-1073. Returns null if the reply doesn't match any expected answer (the journey just waits). */
async function resolveNextNodeOnReply({ trackData, lastNode, receivedText }) {
  if (lastNode.nodeLevelParentId !== 0) {
    return ncJourneyNodesModel.findNextByParentExcludingAnswers({ journeyId: trackData.trackJourneyId, parentId: lastNode.nodeSlno })
  }

  if (lastNode.nodeElementType !== '2') {
    return ncJourneyNodesModel.findNextByParent({ journeyId: trackData.trackJourneyId, parentId: lastNode.nodeSlno })
  }

  const answerNode = await ncJourneyNodesModel.findAnswerNode({ parentId: lastNode.nodeSlno, receivedText })
  if (!answerNode) return null // Unrecognized reply — legacy leaves the journey open and sends nothing.

  const hasSubJourney = await ncJourneyNodesModel.hasSubJourneyChildren(answerNode.nodeSlno)
  return hasSubJourney
    ? ncJourneyNodesModel.findFirstSubJourneyNode({ journeyId: trackData.trackJourneyId, levelParentId: answerNode.nodeSlno })
    : ncJourneyNodesModel.findNextTopLevelByParent({ journeyId: trackData.trackJourneyId, parentId: lastNode.nodeSlno })
}

/**
 * Entry point, called once per genuine inbound WhatsApp message. Exactly the legacy
 * priority: a matching trigger phrase always starts a brand-new journey (this port
 * deliberately does NOT also then check for an active tracker in that same pass —
 * legacy's code runs that check unconditionally afterward too, which looks like an
 * unintentional side effect of the trigger-check and reply-check sharing one
 * function rather than a real "also treat the trigger as a reply" feature: the
 * trigger text essentially never matches a list-reply answer, so it's a no-op in
 * practice, but replicating it exactly would risk double-processing a coincidental
 * match). Otherwise, an active tracker means the client is mid-journey and this
 * message is their reply.
 *
 * @returns {Promise<boolean>} whether a journey actually handled this message.
 */
export async function processInboundForJourney({ employee, userAdminId, jrId, wabaNumber, clientMobile, clientName, receivedText }) {
  const trigger = await ncJourneyMasterModel.findTriggerMatch({ wabaNumber, triggerMessage: receivedText })
  if (trigger) {
    const rootNode = await ncJourneyNodesModel.findRootNode(trigger.journeyId)
    if (!rootNode) return false

    const trackId = await ncJourneyTrackerModel.insertTracker({ clientId: userAdminId, wabaNumber, journeyId: trigger.journeyId, clientMobile })
    await advanceJourney({ employee, trackId, journeyId: trigger.journeyId, clientMobile, clientName, jrId, userAdminId, wabaNumber, startNode: rootNode })
    return true
  }

  const activeTracker = await ncJourneyTrackerModel.findActiveTracker({ wabaNumber, clientMobile })
  if (!activeTracker) return false

  const lastLog = await ncJourneyTrackLogModel.findLastLog(activeTracker.trackId)
  if (!lastLog) return false

  const lastNode = await ncJourneyNodesModel.findNodeBySlno(lastLog.logNodeId)
  if (!lastNode) return false

  const nextNode = await resolveNextNodeOnReply({ trackData: activeTracker, lastNode, receivedText })
  if (!nextNode) return true // A journey is in progress but this reply didn't match any expected answer — nothing to send.

  await advanceJourney({
    employee,
    trackId: activeTracker.trackId,
    journeyId: activeTracker.trackJourneyId,
    clientMobile,
    clientName,
    jrId,
    userAdminId,
    wabaNumber,
    startNode: nextNode,
  })
  return true
}
