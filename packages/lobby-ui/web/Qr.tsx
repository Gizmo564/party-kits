import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** A scannable code for the join link, drawn as inline SVG so nothing is fetched. Always dark-on-white so any phone can read it. */
export function Qr({ text, size = 168 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#05030f', light: '#ffffff' } })
      .then((s) => { if (live) setSvg(s); }).catch(() => { if (live) setSvg(''); });
    return () => { live = false; };
  }, [text]);
  if (!svg) return null;
  return <div className="qr" style={{ width: size, height: size }} role="img" aria-label="QR code to join this room" dangerouslySetInnerHTML={{ __html: svg }} />;
}
