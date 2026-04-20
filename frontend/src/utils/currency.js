const USD_TO_VND = 25000;

export function usdToThousandVnd(usd) {
  const n = Number(usd || 0);
  return Math.round(n * (USD_TO_VND / 1000));
}

export function thousandVndToUsd(thousandVnd) {
  const n = Number(thousandVnd || 0);
  return n / (USD_TO_VND / 1000);
}

export function formatPriceVndFromUsd(usd) {
  const kVnd = usdToThousandVnd(usd);
  return `${kVnd.toLocaleString('vi-VN')} nghin dong`;
}
