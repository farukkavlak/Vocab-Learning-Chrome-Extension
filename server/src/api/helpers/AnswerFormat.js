
const returnAnswerFormat = (answer) => {
    if (answer.charAt(0) === ".") {
        answer = answer.substring(1);
    }
    if (answer.charAt(answer.length - 1) !== ".") {
        answer = answer + ".";
    }
    answer = answer.trim();
    return answer;
}

module.exports = returnAnswerFormat;
