import { deleteFromR2 } from './src/services/r2.js';

async function run() {
  console.log("Testing delete...");
  const result = await deleteFromR2('https://pub-1c6fe6fccf4b467ca02ab5917666a861.r2.dev/test/test-upload.txt');
  console.log("Delete result:", result);
}
run();
