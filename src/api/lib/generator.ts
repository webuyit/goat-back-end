const tomorrowMorning = new Date();
tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
tomorrowMorning.setHours(8, 0, 0, 0);

const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

console.log('Tomorrow Morning:', tomorrowMorning.toISOString());
console.log('Two Hours From Now:', twoHoursFromNow.toISOString());
