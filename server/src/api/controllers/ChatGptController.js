const returnAnswerFormat = require('../helpers/AnswerFormat');
const configureOpenAI = require('../../config/OpenApiConfig');

const getAnswer = async (req, res) => {
    const promptTemp = "I will give you an English word and you will explain them to me. I want you to explain this word to me briefly. Also, give an example sentence without using uncommon words. If this word is not in english. Just answer \"This word is not in English\". Your response should only contain the answer, do not add or correct anything. The word description and the example sentence should be on a separate line. My word is \"";
    const openAI = await configureOpenAI();
    if (openAI.error) {
        return res.status(openAI.status).json(openAI.error);
    }
    let {input} = req.query;

    if(input.trim().length === 0){
        return res.status(400).json({
            error: {
                message: 'Please provide a valid input.',
            },
        });
    }
    try {
        const completion = await openAI.createCompletion({
            model: "text-davinci-003",
            prompt: promptTemp + input + "\"",
            temperature: 0,
            max_tokens: 100,
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
            },
            method: "POST",
        });
        return res.status(200).json({
            result: returnAnswerFormat(completion.data.choices[0].text),
        });
    } catch (error) {
        if (error.response) {
            return res.status(error.response.status).json({
                error: {
                    message: error.response.data.error.message,
                },
            });
        } else {
            return res.status(500).json({
                error: {
                    message: 'An error occurred during your request.',
                },
            });
        }
    }
};

module.exports = {
    getAnswer
}