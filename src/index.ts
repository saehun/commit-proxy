import { getString } from './pipe';

(async (): Promise<void> => {
  const data = await getString();
  console.log(data.split(' '));
})();
