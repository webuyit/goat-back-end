import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';

export const claimReward = expressAsyncHandler(async (req, res) => {
  const { rewardId, userId } = req.params; // assumed you're using middleware to attach user

  if (!userId || !rewardId) {
    res.status(400).json({ message: 'Missing rewardId or user.' });
    throw new Error('Missing rewardId or user.');
  }

  const reward = await prisma.reward.findUnique({
    where: { id: rewardId },
  });

  if (!reward) {
    res.status(404).json({ message: 'Reward not found.' });
    throw new Error('Reward not found.');
  }

  if (reward.userId !== userId) {
    res.status(403).json({ message: 'Unauthorized.' });
    throw new Error('Unauthorized claim.');
  }

  if (reward.status === 'CLAIMED') {
    res.status(400).json({ message: 'Reward already claimed.' });
    throw new Error('Already claimed.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.reward.update({
      where: { id: rewardId },
      data: {
        status: 'CLAIMED',
        claimedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        points: { increment: reward.amount },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount: reward.amount,
        type: 'REWARD_CLAIMED',
        transactionId: rewardId,
      },
    });
  });

  res.status(200).json({ message: 'Reward claimed successfully.' });
});

export const getUserRewards = expressAsyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized.' });
    throw new Error('Unauthorized access.');
  }

  const rewards = await prisma.reward.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ rewards });
});

export const getSingleReward = expressAsyncHandler(async (req, res) => {
  const { rewardId, userId } = req.params;

  if (!userId || !rewardId) {
    res.status(400).json({ message: 'Missing rewardId or user.' });
    throw new Error('Missing rewardId or user.');
  }

  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });

  if (!reward) {
    res.status(404).json({ message: 'Reward not found.' });
    throw new Error('Reward not found.');
  }

  if (reward.userId !== userId) {
    res.status(403).json({ message: 'Unauthorized.' });
    throw new Error('Unauthorized.');
  }

  res.status(200).json({ reward });
});
