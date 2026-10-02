// Demonstration data only. Replace with the college-approved master list later.
export const sampleCourses=[['CS F303','Computer Networks'],['CS F364','Design and Analysis of Algorithms'],['CS F363','Compiler Construction'],['CS F212','Database Systems'],['CS F213','Object Oriented Programming'],['CS F372','Operating Systems']];
export const sampleHeaders=['Course Code','Course Name','Course Head','Faculty Email'];
export const sampleRows=sampleCourses.map(([code,name],i)=>[code,name,`Demo Faculty ${i+1}`,`demo.faculty${i+1}@dubai.bits-pilani.ac.in`]).concat([
 ['MATH F101','Demo Mathematics','Demo Faculty 6','demo.faculty6@dubai.bits-pilani.ac.in'],
 ['PHY F101','Demo Physics','Demo Faculty 7','demo.faculty7@dubai.bits-pilani.ac.in'],
 ['CHEM F101','Demo Chemistry','Demo Faculty 8','demo.faculty8@dubai.bits-pilani.ac.in'],
 ['HSS F101','Demo Humanities','Demo Faculty 9','demo.faculty9@dubai.bits-pilani.ac.in']
]);
