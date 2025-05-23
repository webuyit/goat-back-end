import { ethers } from 'ethers';
import expressAsyncHandler from 'express-async-handler';

export const testGetLtv = expressAsyncHandler(async (req, res) => {
  res.send('testGetLtv');
});
