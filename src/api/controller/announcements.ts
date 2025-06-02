import expressAsyncHandler from 'express-async-handler';
import prisma from '../prisma-client';

export const addAnnouncements = expressAsyncHandler(async (req, res) => {
  const { title, description, coverUrl, link, external, themeColor } = req.body;

  if (!title || !link || !coverUrl) {
    res.status(400).json({ message: 'Missing Required parameters' });
  }
  try {
    const newAnnouncement = await prisma.announcements.create({
      data: {
        title,
        description,
        coverUrl,
        external,
        link,
        themeColor,
      },
    });
    res.status(201).json({
      message: 'New announcment created',
      announcement: newAnnouncement.title,
    });
  } catch (error) {
    res.status(500).json({ error });
  }
});

export const getAnnouncements = expressAsyncHandler(async (req, res) => {
  try {
    const announcemnts = await prisma.announcements.findMany();
    res.status(200).json({
      data: announcemnts,
    });
  } catch (error) {
    res.status(500).json({ error });
  }
});
