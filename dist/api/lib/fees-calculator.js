"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFeeBreakdown = calculateFeeBreakdown;
function calculateFeeBreakdown({ feeAmount, isSponsored, hasReferrer, userBetCount, referralShareRatio, sponsorShareRatio, }) {
    let referralShare = 0;
    let sponsorShare = 0;
    const eligibleForReferral = hasReferrer && userBetCount < 10;
    if (isSponsored) {
        sponsorShare = Math.floor(feeAmount * sponsorShareRatio);
        if (eligibleForReferral) {
            referralShare = Math.floor(feeAmount * referralShareRatio);
            sponsorShare -= referralShare;
        }
    }
    else {
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
