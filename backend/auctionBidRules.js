export function getBidValidationError({
  currentBid,
  bidValue,
  lastBidByWallet,
  duplicateAcceptedBid,
  isAuctionActive,
  isAuctionExpired,
}) {
  if (!isAuctionActive) {
    return 'La subasta no está activa';
  }

  if (isAuctionExpired) {
    return 'La subasta ya terminó';
  }

  const currentBidNumber = Number(currentBid || 0);
  if (Number(bidValue) <= currentBidNumber) {
    return 'La puja debe superar la puja actual';
  }

  const lastBidAmount = lastBidByWallet ? Number(lastBidByWallet.bid_amount || 0) : null;
  if (lastBidAmount !== null && Number(bidValue) <= lastBidAmount) {
    return 'La puja debe superar tu última puja en esta subasta';
  }

  if (duplicateAcceptedBid) {
    return 'Ya registraste esa misma puja en esta subasta';
  }

  return null;
}
