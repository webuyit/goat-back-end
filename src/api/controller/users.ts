import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';
import { generateReferralCode } from '../lib/generateRefferalCode';
import { subDays, startOfWeek, endOfWeek } from 'date-fns';
import { Prisma } from '@prisma/client';
export const registerUser = expressAsyncHandler(async (req, res) => {
  const {
    privyId,
    clerkId,
    referredByCode,
    fullName,
    email,
    firstName,
    lastName,
    username,
    publicKey,
    walletSource,
    authMethod,
    profilePicture,
  } = req.body;

  if (!privyId && !clerkId) {
    res.status(400).json({ message: 'Missing auth provider ID.' });
  }

  // Generate a unique referral code
  let referralCode: string;
  while (true) {
    referralCode = generateReferralCode(); // You can change the length/logic
    const exists = await prisma.user.findUnique({ where: { referralCode } });
    if (!exists) break;
  }

  let referredByUserId: string | undefined;

  if (referredByCode) {
    const referredByUser = await prisma.user.findUnique({
      where: { referralCode: referredByCode },
    });

    if (!referredByUser) {
      res.status(400).json({ message: 'Invalid referral code.' });
    }

    referredByUserId = referredByUser.id;
  }

  // CHECK IF EMAIL IS AVAILABLE

  const existingUser = await prisma.user.findUnique({
    where: { privyId }, // assuming `email` is unique in DB schema
  });

  console.log('already create an account', existingUser);
  if (existingUser) {
    res.status(200).json({
      message: 'User already exists. Linking current session.',
      userId: existingUser.id,
      referralCode: existingUser.referralCode,
    });
    return;
  }
  // Create the user
  const newUser = await prisma.user.create({
    data: {
      privyId,
      clerkId,
      referralCode,
      referredById: referredByUserId,
      fullName,
      firstName,
      lastName,
      email,
      username,
      authMethod,
      profilePicture,
      // All other fields left empty for now (onboarding)
      wallets: {
        create: {
          walletSource,
          publicKey,
          name: walletSource,
        },
      },
    },
  });

  console.log('Registered user ', newUser);
  // Register wallet

  res.status(201).json({
    message: 'User registered successfully.',
    userId: newUser.id,
    referralCode: newUser.referralCode,
  });
});

// Get users

export const getUsersWithStats = expressAsyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';

  const skip = (page - 1) * limit;

  // Filtering logic
  const where = search
    ? {
        OR: [
          {
            username: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
          {
            fullName: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
        ],
      }
    : {};

  // 1. Paginated users
  const users = await prisma.user.findMany({
    where,
    skip,
    take: limit,
    select: {
      id: true,
      faucetPoints: true,
      fullName: true,
      firstName: true,
      lastName: true,
      points: true,
      phone: true,
      profilePicture: true,
      createdAt: true,
      earlyAccess: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // 2. Total count
  const totalUsers = await prisma.user.count();

  // 3. Weekly growth comparison
  const now = new Date();
  const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
  const startOfLastWeek = subDays(startOfThisWeek, 7);
  const endOfLastWeek = subDays(startOfThisWeek, 1);

  const thisWeekCount = await prisma.user.count({
    where: {
      createdAt: {
        gte: startOfThisWeek,
      },
    },
  });

  const lastWeekCount = await prisma.user.count({
    where: {
      createdAt: {
        gte: startOfLastWeek,
        lte: endOfLastWeek,
      },
    },
  });

  const growthPercent =
    lastWeekCount === 0
      ? 100
      : ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100;

  // 4. Users today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await prisma.user.count({
    where: {
      createdAt: {
        gte: today,
      },
    },
  });

  res.status(200).json({
    users,
    pagination: {
      total: totalUsers,
      page,
      limit,
    },
    stats: {
      totalUsers,
      newUsersThisWeek: thisWeekCount,
      newUsersLastWeek: lastWeekCount,
      growthPercent: Math.round(growthPercent * 100) / 100, // round to 2 decimal places
      usersToday: todayCount,
    },
  });
});

export const getUser = expressAsyncHandler(async (req, res) => {
  const { userId, privyId, email } = req.query;

  if (!userId && !privyId && !email) {
    res.status(400).json({
      message: 'Provide at least one filter: userId, privyId, or email.',
    });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      ...(userId && { id: String(userId) }),
      ...(privyId && { privyId: String(privyId) }),
      ...(email && { email: String(email).toLowerCase() }),
    },
    include: {
      wallets: {
        select: {
          walletSource: true,
          name: true,
          publicKey: true,
          active: true,
        },
      },
      bets: {},
      // Add includes like referral info if needed
    },
  });

  if (!user) {
    res.status(404).json({ message: 'User not found.' });
  }

  res.status(200).json({
    message: 'User found.',
    user,
  });
});

export const getUserStats = expressAsyncHandler(async (req, res) => {
  const { userId, privyId, email } = req.query;

  if (!userId && !privyId && !email) {
    res.status(400).json({
      message: 'Provide at least one filter: userId, privyId, or email.',
    });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      ...(userId && { id: String(userId) }),
      ...(privyId && { privyId: String(privyId) }),
      ...(email && { email: String(email).toLowerCase() }),
    },
    include: {
      wallets: {
        select: {
          walletSource: true,
          name: true,
          publicKey: true,
          active: true,
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ message: 'User not found.' });
  }

  const [betsCount, unreadNotifications] = await Promise.all([
    prisma.bet.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  res.status(200).json({
    user,
    stats: {
      betsCount,
      unreadNotifications,
    },
  });
});
