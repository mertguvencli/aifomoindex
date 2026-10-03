import assert from "node:assert/strict";
import test from "node:test";
import { classifyEntities, publisherOf } from "../src/lib/taxonomy";

test("a lab's own post found on Hacker News is filed under the lab", () => {
  assert.equal(publisherOf("hackernews", "x.ai"), "xai");
  assert.equal(publisherOf("hackernews", "status.x.ai"), "xai");
  assert.equal(publisherOf("hackernews", "api-docs.deepseek.com"), "deepseek");
  assert.equal(publisherOf("hackernews", "qwen.ai"), "qwen");
  assert.equal(publisherOf("hackernews", "kimi.com"), "moonshot");
});

test("lookalike hosts and crawled sources keep their source", () => {
  assert.equal(publisherOf("hackernews", "spacex.ai"), "hackernews");
  assert.equal(publisherOf("hackernews", "speakz.ai"), "hackernews");
  assert.equal(publisherOf("hackernews", "minimaxir.com"), "hackernews");
  assert.equal(publisherOf("openai", "x.ai"), "openai");
});

test("lab publishers tag their own entity even when the title doesn't name it", () => {
  assert.ok(classifyEntities("Introducing Bot", "xai").includes("xai"));
  assert.ok(classifyEntities("Qwen3.8 Omni Flash", "hackernews").includes("alibaba"));
  assert.ok(classifyEntities("GLM-5.3 is now open-weight", "hackernews").includes("zhipu"));
});
