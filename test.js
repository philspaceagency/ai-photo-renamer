import fs from 'fs/promises';
import 'dotenv/config';
import slugify from '@sindresorhus/slugify';
import path from 'path';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const MODEL_NAME = "gemini-1.5-flash";
const API_KEY = process.env.GOOGLE_AI_KEY;

const SOURCE = 'C:\\Users\\acer\\OneDrive - Philippine Space Agency\\DG tasks\\renamed_photos\\source\\2023.09.08_ECCP Meeting\\';
const OUTPUT = 'C:\\Users\\acer\\OneDrive - Philippine Space Agency\\DG tasks\\renamed_photos\\output\\2023.09.08_ECCP Meeting\\';

async function generateUniqueFilename(directory, originalName) {
  const extension = path.extname(originalName); // Extract the file extension (e.g., .jpg)
  const basename = path.basename(originalName, extension); // Get the file name without the extension
  let filename = slugify(basename) + extension; // Create the slugified filename
  let uniqueName = filename;
  let counter = 1;

  // Check if the file already exists, and increment a counter if it does
  while (true) {
    try {
      await fs.access(path.join(directory, uniqueName));  // Check if the file exists
      uniqueName = `${slugify(basename)}-${counter}${extension}`;  // Append counter to the filename
      counter++;  // Increment the counter
    } catch (err) {
      // If fs.access throws an error, it means the file doesn't exist, so we can use this filename
      break;
    }
  }
  
  return uniqueName;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getImageSummary(path) {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 0.4,
    topK: 32,
    topP: 1,
    maxOutputTokens: 4096,
  };

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  // ToDo potentially - make mimeType actually check the image type
  const parts = [
    {text: "Write a one sentence short summary of this image. The sentence should be no more than five words.\n\n"},
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: Buffer.from(await fs.readFile(path)).toString("base64")
      }
    },
    {text: "\n"},
  ];

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig,
    safetySettings,
  });

  // This assumes a good response. Never assume.
  return result.response.candidates[0].content.parts[0].text.trim();
}


const files = await fs.readdir(SOURCE);
for(let file of files) {
	console.log(`Processing ${file}`);
	let result = await getImageSummary(SOURCE + file);

  // Add a delay between requests (e.g., 1 second)
  await delay(3000);

  // Generate a unique filename
  let newFilename = await generateUniqueFilename(OUTPUT, result + '.jpg');
  console.log(`Copying to ${newFilename}`);

	await fs.copyFile(SOURCE + file, path.join(OUTPUT, newFilename));
}

console.log('Done');
