const carLines = '';

const JSONLinesArray = carLines.split('\n');

const arr = [];

JSONLinesArray.forEach((JSONLine) => {
  const car = JSON.parse(JSONLine);
  console.log({ car });
  arr.push(car);
});

console.log(arr.length);
