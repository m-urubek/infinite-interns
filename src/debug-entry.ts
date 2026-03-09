/* eslint-disable no-undef */
// eslint-disable-next-line local/enforce-namespace-imports
import { setMaxListeners } from "node:events";
setMaxListeners(20);

import * as MainPipelineGraph from "./main-pipeline-graph/main-pipeline-graph";

type PipelineInput = {
  assignment: NonNullable<string>;
  projectDir: NonNullable<string>;
  buildCommand: string | null | undefined;
};

type ThreadConfig = {
  configurable: NonNullable<ThreadConfigurable>;
};

type ThreadConfigurable = {
  thread_id: NonNullable<string>;
};

async function main(): NonNullable<Promise<void>> {
  const threadId: NonNullable<string> = "debug-thread-1";

  const input: NonNullable<PipelineInput> = {
    assignment: "Create an app in react and typescript to manage todos.",
    projectDir: "/mnt/d/TodoApp",
    buildCommand: null,
  };

  console.log("Starting pipeline with input:", input);

  const config: NonNullable<ThreadConfig> = {
    configurable: { thread_id: threadId },
  };

  const result = await MainPipelineGraph.graph.invoke(input, config);

  console.log("Pipeline result:", JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
