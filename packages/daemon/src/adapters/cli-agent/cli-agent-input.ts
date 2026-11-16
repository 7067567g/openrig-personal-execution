// TTY-safe submitted-block reader for the CLI agent runner.
//
// Adapted from the Pi runner's input boundary: canonical TTY buffers can
// overflow before Node sees a large paste, and readline would submit every
// newline inside a bracketed paste as a separate prompt. OpenCode/DSH seats
// need the opposite: one paste block becomes exactly one task.
import { PassThrough } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import readline from "node:readline";

export const MAX_CLI_AGENT_INPUT_BYTES = 1024 * 1024;

export function createCliAgentInput(
  input: NodeJS.ReadStream,
  output: NodeJS.WriteStream,
  onSubmit: (block: string) => void,
): readline.Interface {
  const reject = () => output.write(
    "[cli-agent-runner] input rejected: maximum 1048576 UTF-8 bytes; send a smaller message.\n",
  );
  const submit = (block: string) => {
    if (Buffer.byteLength(block) > MAX_CLI_AGENT_INPUT_BYTES) reject();
    else if (block.trim()) onSubmit(block);
  };
  if (!input.isTTY || !output.isTTY) {
    return readline.createInterface({ input, crlfDelay: Infinity }).on("line", submit);
  }

  const keys = new PassThrough();
  const editor = readline.createInterface({
    input: keys,
    output,
    terminal: true,
    prompt: "",
    historySize: 0,
    crlfDelay: Infinity,
  });
  if (Object.prototype.hasOwnProperty.call(editor, "_ttyWrite")) {
    delete (editor as unknown as { _ttyWrite?: unknown })._ttyWrite;
  }
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let paste: string | null = null;
  let pasteBytes = 0;
  let discarded = false;
  const setLine = (line: string, cursor: number) => {
    Object.assign(editor, { line, cursor });
    editor.prompt(true);
  };
  const clear = () => setLine("", 0);
  const consume = (text: string) => {
    if (paste === null) {
      keys.write(text);
    } else if (!discarded) {
      pasteBytes += Buffer.byteLength(text);
      if (pasteBytes > MAX_CLI_AGENT_INPUT_BYTES) {
        paste = "";
        discarded = true;
        clear();
        reject();
      } else {
        paste += text;
      }
    }
  };
  const receive = (chunk: Buffer) => {
    pending += decoder.write(chunk);
    while (pending) {
      const marker = paste === null ? "\u001b[200~" : "\u001b[201~";
      const boundary = pending.indexOf(marker);
      const interrupt = pending.indexOf("\u0003");
      const at = boundary < 0 ? interrupt : interrupt < 0 ? boundary : Math.min(boundary, interrupt);
      if (at < 0) {
        let tail = Math.min(marker.length - 1, pending.length);
        while (tail && !marker.startsWith(pending.slice(-tail))) tail -= 1;
        consume(pending.slice(0, pending.length - tail));
        pending = pending.slice(pending.length - tail);
        break;
      }
      consume(pending.slice(0, at));
      pending = pending.slice(at + (at === interrupt ? 1 : marker.length));
      if (at === interrupt) {
        paste = null;
        discarded = false;
        clear();
        output.write("\n[cli-agent-runner] input cleared\n");
      } else if (paste === null) {
        paste = "";
        pasteBytes = 0;
        discarded = false;
      } else {
        if (!discarded) {
          const line = editor.line.slice(0, editor.cursor) + paste + editor.line.slice(editor.cursor);
          if (Buffer.byteLength(line) > MAX_CLI_AGENT_INPUT_BYTES) {
            clear();
            reject();
          } else {
            setLine(line, editor.cursor + paste.length);
          }
        }
        paste = null;
      }
    }
  };
  const wasRaw = input.isRaw;
  const end = () => editor.close();
  input.setRawMode(true);
  output.write("\u001b[?2004h");
  input.on("data", receive);
  input.once("end", end);
  editor.on("line", submit);
  editor.once("close", () => {
    input.removeListener("data", receive);
    input.removeListener("end", end);
    input.setRawMode(wasRaw);
    input.pause();
    keys.destroy();
    output.write("\u001b[?2004l");
  });
  return editor;
}
