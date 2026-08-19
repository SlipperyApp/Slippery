/* The parts of the Telegram contract that are facts rather than calls.
 *
 * Split out so the tests can hold them without a bot token: the 64 byte
 * callback limit and the command list are both things that break silently in
 * production and can be proved here for nothing.
 */
/* The commands BotFather is told about, so /setcommands and the help text
   cannot drift apart. */
export const COMMANDS = [
  { command: 'start', description: 'link this chat to your account' },
  { command: 'today', description: 'profit today' },
  { command: 'week', description: 'profit this week' },
  { command: 'open', description: 'what is still running' },
  { command: 'last', description: 'the last bet logged' },
  { command: 'undo', description: 'remove the last bet from this chat' },
  { command: 'help', description: 'what I can do' },
  { command: 'stop', description: 'unlink this chat' },
];


/* callback_data is 64 BYTES. The state lives in `pending_reads` and the
   button carries only a short id, which is why a four-leg builder with long
   team names still fits. */
export const callbackData = (action: string, id: string) => {
  const data = `${action}:${id}`;
  if (Buffer.byteLength(data) > 64) throw new Error('callback_data over 64 bytes');
  return data;
};
