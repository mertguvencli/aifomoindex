import assert from "node:assert/strict";
import test from "node:test";
import { classifyEntities, classifyTopics, publisherOf } from "../src/lib/taxonomy";

test("a lab's own post found on Hacker News is filed under the lab", () => {
  assert.equal(publisherOf("hackernews", "x.ai"), "xai");
  assert.equal(publisherOf("hackernews", "status.x.ai"), "xai");
  assert.equal(publisherOf("hackernews", "api-docs.deepseek.com"), "deepseek");
  assert.equal(publisherOf("hackernews", "qwen.ai"), "qwen");
  assert.equal(publisherOf("hackernews", "kimi.com"), "moonshot");
  assert.equal(publisherOf("hackernews", "runwayml.com"), "runway");
  assert.equal(publisherOf("hackernews", "elevenlabs.io"), "elevenlabs");
  assert.equal(publisherOf("hackernews", "www.physicalintelligence.company"), "physicalintelligence");
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

test("image, video, audio and robot launches are tagged without saying image or video", () => {
  assert.ok(classifyTopics("FLUX.2 [klein] is out", "hackernews").includes("media"));
  assert.ok(classifyTopics("Introducing Gen-4.5", "runway").includes("media"));
  assert.ok(classifyTopics("Suno v6", "hackernews").includes("media"));
  assert.ok(classifyTopics("Figure's humanoids learn laundry", "hackernews").includes("robotics"));
  assert.ok(!classifyTopics("Our startup is in flux", "hackernews").includes("media"));
  assert.ok(classifyEntities("FLUX.1 Kontext in Photoshop", "hackernews").includes("bfl"));
  assert.ok(classifyEntities("FLUX.1 Kontext in Photoshop", "hackernews").includes("adobe"));
  assert.ok(classifyEntities("Helix 02", "figure").includes("figure"));
});
