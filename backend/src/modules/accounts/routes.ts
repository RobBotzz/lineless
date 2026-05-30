import { Router } from 'express';
import { signup, login } from './service';

const accountRouter = Router();

accountRouter.post('/signup', signup);
accountRouter.post('/login', login);

export default accountRouter;