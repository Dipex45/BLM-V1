import { useEffect, useState } from 'react';

type ResilientImageProps = {
  src?: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
};

export default function ResilientImage({ src, fallbackSrc, alt, className }: ResilientImageProps) {
  const [displaySrc, setDisplaySrc] = useState(fallbackSrc);

  useEffect(() => {
    let active = true;
    setDisplaySrc(fallbackSrc);
    if (!src || src === fallbackSrc) return () => {
      active = false;
    };

    const probe = new Image();
    probe.onload = () => {
      if (active) setDisplaySrc(src);
    };
    probe.src = src;
    return () => {
      active = false;
    };
  }, [fallbackSrc, src]);

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      decoding="async"
      onError={() => setDisplaySrc(fallbackSrc)}
    />
  );
}
