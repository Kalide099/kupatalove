const OpenAI = require('openai');

let openai = null;

const getClient = () => {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith('sk-placeholder')) {
      return null;
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
};

/**
 * Generate AI compatibility score and icebreaker between two users
 */
const generateCompatibility = async (user1, user2) => {
  const client = getClient();
  if (!client) {
    // Return mock data when no API key
    return {
      score: Math.floor(50 + Math.random() * 45),
      icebreaker: `Hey! You both seem to have great vibes. Why not start with what you're passionate about? 😊`,
      reasons: ['Similar interests', 'Great energy match'],
    };
  }

  try {
    const prompt = `You are an AI matchmaking assistant for KupataLove dating app.

Analyze the compatibility between these two users and respond in JSON format.

User 1:
- Name: ${user1.name}
- Age: ${calculateAge(user1.birthdate)}
- Bio: ${user1.bio || 'No bio'}
- City: ${user1.city || 'Unknown'}
- Language: ${user1.language}

User 2:
- Name: ${user2.name}
- Age: ${calculateAge(user2.birthdate)}
- Bio: ${user2.bio || 'No bio'}
- City: ${user2.city || 'Unknown'}
- Language: ${user2.language}

Respond with JSON only:
{
  "score": <number 0-100>,
  "icebreaker": "<a fun, personalized opening message suggestion for User 1 to send to User 2>",
  "reasons": ["<reason 1>", "<reason 2>", "<reason 3>"]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 300,
      temperature: 0.7,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return {
      score: Math.min(100, Math.max(0, result.score || 75)),
      icebreaker: result.icebreaker || 'Hey there! Would love to get to know you 😊',
      reasons: result.reasons || [],
    };
  } catch (err) {
    console.warn('AI compatibility error:', err.message);
    return {
      score: Math.floor(60 + Math.random() * 35),
      icebreaker: `Hi ${user2.name}! Your profile caught my eye. What's something you're really passionate about?`,
      reasons: [],
    };
  }
};

/**
 * Analyze a user's personality from their bio for better matching weights
 */
const analyzePersonality = async (bio) => {
  const client = getClient();
  if (!client || !bio) return {};

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Analyze this dating profile bio and extract personality traits as a JSON object with weights 0-1:
Bio: "${bio}"
Respond with: { "adventurous": 0.8, "intellectual": 0.6, "romantic": 0.9, "humorous": 0.4, "creative": 0.7 }`
      }],
      response_format: { type: 'json_object' },
      max_tokens: 150,
    });
    return JSON.parse(completion.choices[0].message.content);
  } catch {
    return {};
  }
};

/**
 * Generate a conversation starter based on match context
 */
const generateConversationStarter = async (user1, user2) => {
  const compat = await generateCompatibility(user1, user2);
  return compat.icebreaker;
};

const calculateAge = (birthdate) => {
  if (!birthdate) return 'Unknown';
  const diff = Date.now() - new Date(birthdate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

/**
 * Transcribe audio and translate to target language
 */
const transcribeAudio = async (filePath, targetLanguage) => {
  const client = getClient();
  if (!client) {
    // Mock for development
    return {
      original: "This is a mocked voice note transcription.",
      translated: "This is a mocked voice note translation.",
    };
  }

  try {
    const fs = require('fs');
    
    // 1. Transcribe audio to its native text
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });
    
    const originalText = transcription.text;
    
    // 2. Translate to recipient's language
    const translationCompletion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Translate the following text to ${targetLanguage}. Reply ONLY with the translated text.`
      }, {
        role: 'user',
        content: originalText
      }],
      max_tokens: 300,
    });
    
    return {
      original: originalText,
      translated: translationCompletion.choices[0].message.content.trim(),
    };
  } catch (err) {
    console.warn('Transcription error:', err.message);
    return {
      original: "Transcription failed.",
      translated: "Transcription failed.",
    };
  }
};

module.exports = { generateCompatibility, analyzePersonality, generateConversationStarter, transcribeAudio };
