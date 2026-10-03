import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import { sourceLabel } from "./feed-utils";
import anthropic from "./logos/anthropic.png";
import deepmind from "./logos/deepmind.png";
import deepseek from "./logos/deepseek.png";
import googleai from "./logos/googleai.png";
import hackernews from "./logos/hackernews.svg";
import huggingface from "./logos/huggingface.png";
import mistral from "./logos/mistral.png";
import moonshot from "./logos/moonshot.png";
import openai from "./logos/openai.png";
import qwen from "./logos/qwen.png";
import xai from "./logos/xai.png";
import zhipu from "./logos/zhipu.png";

const LOGOS: Record<string, StaticImageData> = {
  anthropic,
  deepmind,
  deepseek,
  googleai,
  hackernews,
  huggingface,
  mistral,
  moonshot,
  openai,
  qwen,
  xai,
  zhipu,
};

/** The source's own logo; sources without one get a monogram tile. */
export function SourceLogo({ source, className }: { source: string; className?: string }) {
  const logo = LOGOS[source];
  if (!logo) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-gray-900 font-serif text-[10px] leading-none text-white",
          className,
        )}
      >
        {sourceLabel(source).charAt(0).toLowerCase()}
      </span>
    );
  }
  return <Image src={logo} alt="" width={32} height={32} className={cn("size-4 shrink-0 rounded-[4px]", className)} />;
}
