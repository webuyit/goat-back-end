import express from 'express'

import { testGetLtv } from '../controller/testingController'

const router = express.Router()

router.route("/").get(testGetLtv)

export default router