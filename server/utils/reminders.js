// Meetup reminders. Every minute the server looks at accepted trades with a meetup and, when
// the time comes, writes a reminder into the trade's chat. That goes out like any other
// notification (pop-up, bell, desktop alert, and it's waiting if you were logged out).
//
//   soon    within 24 hours of the meetup   "Reminder: your meetup is tomorrow at Bishan MRT, 6:30 pm."
//   twoHrs  within 2 hours                  "Reminder: your meetup is in about 2 hours …"
//   now     at the meetup time              "It's meetup time! …"
//   overdue 3 hours after, not confirmed    "Did the swap happen? …"
//
// Each one is sent once per meetup; changing the place or time starts over.
// Times are the server's local time (the meetup date/time are typed in Singapore time).
const { Trade } = require('../models/Trade');
const Message = require('../models/Message');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const STEPS = ['soon', 'twoHrs', 'now', 'overdue'];

function meetupTime(meetup) {
    if (!meetup?.date || !meetup?.time) return null;
    const at = new Date(`${meetup.date}T${meetup.time}:00`);
    return Number.isNaN(at.getTime()) ? null : at;
}

// "Bishan MRT Station (NS17 / CC15)" -> "Bishan MRT Station"; OneMap names are in capitals
function shortPlace(name = '') {
    const plain = name.replace(/\s*\(.*\)\s*$/, '').toLowerCase();
    return plain.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bMrt\b/g, 'MRT').replace(/\bLrt\b/g, 'LRT');
}

function clock(at) {
    return at.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

function dayWord(at, now) {
    const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((start(at) - start(now)) / (24 * HOUR));
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    return at.toLocaleDateString('en-SG', { weekday: 'long' });
}

// Which reminder is due now (the latest one only, so a late check doesn't send three at once)
function dueStep(at, now) {
    const diff = at - now;
    if (diff <= -3 * HOUR) return 'overdue';
    if (diff <= 0 && diff > -60 * MINUTE) return 'now';
    if (diff > 0 && diff <= 2 * HOUR) return 'twoHrs';
    if (diff > 2 * HOUR && diff <= 24 * HOUR) return 'soon';
    return null;
}

function reminderText(step, meetup, at, now) {
    const place = shortPlace(meetup.name);
    if (step === 'soon') return `Reminder: your meetup is ${dayWord(at, now)} at ${place}, ${clock(at)}.`;
    if (step === 'twoHrs') {
        const minutes = Math.max(5, Math.round((at - now) / (5 * MINUTE)) * 5);
        const inWords = minutes >= 90 ? 'in about 2 hours' : minutes >= 50 ? 'in about an hour' : `in about ${minutes} minutes`;
        return `Reminder: your meetup is ${inWords} at ${place} (${clock(at)}).`;
    }
    if (step === 'now') return `It's meetup time! Meet at ${place}, tick the checklist together, then confirm the handover.`;
    return 'Did the swap happen? Confirm the handover, or pick a new time if it didn\'t.';
}

// The key that identifies "this" meetup; a new place/date/time means a new set of reminders
const meetupKey = (m) => `${m.name}|${m.date}|${m.time}`;

async function checkReminders(now = new Date()) {
    const trades = await Trade.find({ status: 'accepted', 'meetup.date': { $exists: true, $ne: '' } })
        .select('meetup reminders');
    let sent = 0;
    for (const trade of trades) {
        const at = meetupTime(trade.meetup);
        if (!at) continue;
        const key = meetupKey(trade.meetup);
        const already = trade.reminders?.key === key ? trade.reminders.sent || [] : [];
        const step = dueStep(at, now);
        if (!step || already.includes(step)) continue;
        // Also count earlier steps as done, so they don't fire after a later one
        const done = STEPS.slice(0, STEPS.indexOf(step) + 1);
        // A plain update (never clashes with other changes to the trade)
        await Trade.updateOne({ _id: trade._id }, { $set: { reminders: { key, sent: [...new Set([...already, ...done])] } } });
        await Message.addSystemMessage(trade._id, reminderText(step, trade.meetup, at, now));
        sent++;
    }
    return sent;
}

// Started by server.js once the database is connected
function startReminders(everyMs = MINUTE) {
    const run = () => checkReminders().catch((err) => console.error('Reminders:', err.message));
    run();
    return setInterval(run, everyMs);
}

module.exports = { checkReminders, startReminders, dueStep, reminderText, meetupTime };
