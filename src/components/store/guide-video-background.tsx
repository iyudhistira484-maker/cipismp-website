import { DecorativeVideoBackground } from "@/components/store/decorative-video-background";

export function GuideVideoBackground() {
  return (
    <DecorativeVideoBackground
      src="https://motionbgs.com/media/9266/minecraft-sunset-farm.960x540.mp4"
      poster="/images/gameplay/forest-path.webp"
      className="guide-video absolute inset-0 -z-10 overflow-hidden bg-[#332331] bg-[url('/images/gameplay/forest-path.webp')] bg-cover bg-center"
      overlayClassName="absolute inset-0 bg-gradient-to-r from-[#261925]/95 via-[#3b2938]/85 to-[#3b2938]/65"
    />
  );
}
