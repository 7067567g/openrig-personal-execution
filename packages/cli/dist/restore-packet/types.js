// types.ts — shared TypeScript types for the restore-packet generator.
//
// Both runtime adapters (codex-jsonl-parser, claude-transcript-parser)
// emit the same StructuredTranscript shape. Downstream modules
// (redaction, omitted-records, packet-writer) consume this shape
// without caring about the source runtime.
export function emptyOmittedCounts() {
    return {
        reasoning_records: 0,
        raw_tool_outputs: 0,
        function_call_output: 0,
        redacted_secrets: 0,
    };
}
//# sourceMappingURL=types.js.map