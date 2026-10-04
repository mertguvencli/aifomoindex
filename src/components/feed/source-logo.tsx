import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
import { sourceLabel } from "./feed-utils";
import agility from "./logos/agility.png";
import anthropic from "./logos/anthropic.png";
import bfl from "./logos/bfl.png";
import bostondynamics from "./logos/bostondynamics.png";
import cartesia from "./logos/cartesia.png";
import deepmind from "./logos/deepmind.png";
import deepseek from "./logos/deepseek.png";
import elevenlabs from "./logos/elevenlabs.png";
import figure from "./logos/figure.png";
import googleai from "./logos/googleai.png";
import hackernews from "./logos/hackernews.svg";
import huggingface from "./logos/huggingface.png";
import kling from "./logos/kling.png";
import krea from "./logos/krea.png";
import luma from "./logos/luma.png";
import meta from "./logos/meta.svg";
import midjourney from "./logos/midjourney.png";
import mistral from "./logos/mistral.png";
import moonshot from "./logos/moonshot.png";
import nvidia from "./logos/nvidia.svg";
import openai from "./logos/openai.png";
import physicalintelligence from "./logos/physicalintelligence.png";
import pika from "./logos/pika.png";
import qwen from "./logos/qwen.png";
import runway from "./logos/runway.png";
import stability from "./logos/stability.png";
import suno from "./logos/suno.png";
import udio from "./logos/udio.png";
import wayve from "./logos/wayve.png";
import worldlabs from "./logos/worldlabs.png";
import xai from "./logos/xai.png";
import zhipu from "./logos/zhipu.png";

const LOGOS: Record<string, StaticImageData> = {
  agility,
  anthropic,
  bfl,
  bostondynamics,
  cartesia,
  deepmind,
  deepseek,
  elevenlabs,
  figure,
  googleai,
  hackernews,
  huggingface,
  kling,
  krea,
  luma,
  meta,
  midjourney,
  mistral,
  moonshot,
  nvidia,
  openai,
  physicalintelligence,
  pika,
  qwen,
  runway,
  stability,
  suno,
  udio,
  wayve,
  worldlabs,
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
