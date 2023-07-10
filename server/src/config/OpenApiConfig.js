const { Configuration, OpenAIApi } = require("openai");

const configureOpenAI = async () => {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);
  
  if (!configuration.apiKey) {
    return {
      error: {
        message: "OpenAI API key not configured, please follow instructions in README.md",
      },
      status : 500
    };
  }
  return openai;
}

module.exports = configureOpenAI;