type FeeBreakdownOptions = {
  feeAmount: number;
  isSponsored: boolean;
  hasReferrer: boolean;
  userBetCount: number;
  referralShareRatio: number; // e.g. 0.1 for 10%
  sponsorShareRatio: number; // e.g. 0.3 for 30%
};

type FeeBreakdownResult = {
  referralShare: number;
  sponsorShare: number;
  platformNetFee: number;
};

export function calculateFeeBreakdown({
  feeAmount,
  isSponsored,
  hasReferrer,
  userBetCount,
  referralShareRatio,
  sponsorShareRatio,
}: FeeBreakdownOptions): FeeBreakdownResult {
  let referralShare = 0;
  let sponsorShare = 0;

  const eligibleForReferral = hasReferrer && userBetCount < 10;

  if (isSponsored) {
    sponsorShare = Math.floor(feeAmount * sponsorShareRatio);

    if (eligibleForReferral) {
      referralShare = Math.floor(feeAmount * referralShareRatio);
      sponsorShare -= referralShare;
    }
  } else {
    if (eligibleForReferral) {
      referralShare = Math.floor(feeAmount * referralShareRatio);
    }
  }

  const platformNetFee = feeAmount - referralShare - sponsorShare;

  return {
    referralShare,
    sponsorShare,
    platformNetFee,
  };
}
