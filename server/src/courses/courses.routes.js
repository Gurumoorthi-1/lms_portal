import express from 'express';
import { CoursesService } from './courses.service.js';

const router = express.Router();
const coursesService = new CoursesService();

router.get('/', async (req, res) => {
  try {
    const result = await coursesService.findAll();
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/:slug', async (req, res) => {
  try {
    const result = await coursesService.findBySlug(req.params.slug);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.get('/:id/topics', async (req, res) => {
  try {
    const result = await coursesService.findTopicsByCourse(req.params.id);
    res.json(result);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

export default router;
