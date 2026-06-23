const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function usd(n: number): string {
  return dollars.format(Math.round(n));
}

export function signedUsd(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return sign + usd(Math.abs(n));
}

export function pct(fraction: number): string {
  return (fraction * 100).toFixed(1) + "%";
}
