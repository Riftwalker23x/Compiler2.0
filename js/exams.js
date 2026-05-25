/* Exam schedule */
// Dates are relative to today for demo purposes
function dOff(d){const x=new Date();x.setDate(x.getDate()+d);return x;}
function dFmt(d){const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;}
function dDay(d){return["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];}

const EXAM_SCHEDULE={
  CS:{
    "2023":{
      A:{
        S1:[
          {course:"Data Structures",date:dOff(-20),time:"09:00 AM",room:"D-Audi",duration:"2 hrs"},
          {course:"Digital Logic Design",date:dOff(-18),time:"02:00 PM",room:"D-301",duration:"2 hrs"},
          {course:"Calculus-II",date:dOff(-16),time:"11:00 AM",room:"D-201",duration:"2 hrs"},
          {course:"OOP",date:dOff(-14),time:"09:00 AM",room:"D-Lab1",duration:"1.5 hrs"},
          {course:"Communication Skills",date:dOff(-12),time:"02:00 PM",room:"D-102",duration:"1.5 hrs"},
        ],
        S2:[
          {course:"Data Structures",date:dOff(5),time:"09:00 AM",room:"D-Audi",duration:"2 hrs"},
          {course:"Digital Logic Design",date:dOff(7),time:"02:00 PM",room:"D-301",duration:"2 hrs"},
          {course:"Calculus-II",date:dOff(9),time:"11:00 AM",room:"D-201",duration:"2 hrs"},
          {course:"OOP",date:dOff(11),time:"09:00 AM",room:"D-Lab1",duration:"1.5 hrs"},
          {course:"Islamic Studies",date:dOff(13),time:"02:00 PM",room:"D-102",duration:"1.5 hrs"},
        ],
        FIN:[
          {course:"Data Structures",date:dOff(35),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},
          {course:"Digital Logic Design",date:dOff(37),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},
          {course:"Calculus-II",date:dOff(39),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},
          {course:"OOP",date:dOff(41),time:"02:00 PM",room:"D-Lab1",duration:"2.5 hrs"},
          {course:"Communication Skills",date:dOff(43),time:"11:00 AM",room:"D-201",duration:"2 hrs"},
          {course:"Linear Algebra",date:dOff(45),time:"09:00 AM",room:"D-301",duration:"3 hrs"},
        ]
      },
      B:{
        S1:[
          {course:"Programming Fundamentals",date:dOff(-19),time:"09:00 AM",room:"D-101",duration:"2 hrs"},
          {course:"Calculus-I",date:dOff(-17),time:"11:00 AM",room:"D-201",duration:"2 hrs"},
          {course:"MLOPs",date:dOff(-15),time:"02:00 PM",room:"D-401",duration:"1.5 hrs"},
          {course:"Entrepreneurship",date:dOff(-13),time:"09:00 AM",room:"D-313",duration:"1.5 hrs"},
        ],
        S2:[
          {course:"Programming Fundamentals",date:dOff(6),time:"09:00 AM",room:"D-101",duration:"2 hrs"},
          {course:"Calculus-I",date:dOff(8),time:"11:00 AM",room:"D-201",duration:"2 hrs"},
          {course:"MLOPs",date:dOff(10),time:"02:00 PM",room:"D-401",duration:"1.5 hrs"},
          {course:"Fund of SPM",date:dOff(12),time:"09:00 AM",room:"D-316",duration:"1.5 hrs"},
          {course:"Agentic AI",date:dOff(14),time:"02:00 PM",room:"D-402",duration:"1.5 hrs"},
        ],
        FIN:[
          {course:"Programming Fundamentals",date:dOff(36),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},
          {course:"Calculus-I",date:dOff(38),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"},
          {course:"MLOPs",date:dOff(40),time:"02:00 PM",room:"D-401",duration:"2.5 hrs"},
          {course:"Discrete Structures",date:dOff(42),time:"09:00 AM",room:"D-301",duration:"3 hrs"},
          {course:"Pakistan Studies",date:dOff(44),time:"11:00 AM",room:"D-201",duration:"2 hrs"},
        ]
      },
      C:{
        S1:[{course:"Web Engineering",date:dOff(-18),time:"09:00 AM",room:"D-301",duration:"2 hrs"},{course:"Database Systems",date:dOff(-16),time:"02:00 PM",room:"D-313",duration:"2 hrs"}],
        S2:[{course:"Web Engineering",date:dOff(7),time:"09:00 AM",room:"D-301",duration:"2 hrs"},{course:"Computer Networks",date:dOff(9),time:"11:00 AM",room:"D-402",duration:"2 hrs"},{course:"Software Engineering",date:dOff(11),time:"02:00 PM",room:"D-316",duration:"1.5 hrs"}],
        FIN:[{course:"Web Engineering",date:dOff(37),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Database Systems",date:dOff(39),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},{course:"Computer Networks",date:dOff(41),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Software Engineering",date:dOff(43),time:"11:00 AM",room:"D-316",duration:"2.5 hrs"}]
      },
      D:{
        S1:[{course:"Compiler Construction",date:dOff(-17),time:"02:00 PM",room:"D-401",duration:"2 hrs"},{course:"Operating Systems",date:dOff(-15),time:"09:00 AM",room:"D-302",duration:"2 hrs"}],
        S2:[{course:"Compiler Construction",date:dOff(6),time:"02:00 PM",room:"D-401",duration:"2 hrs"},{course:"Theory of Automata",date:dOff(8),time:"09:00 AM",room:"D-201",duration:"2 hrs"},{course:"Elective",date:dOff(10),time:"11:00 AM",room:"D-501",duration:"2 hrs"}],
        FIN:[{course:"Compiler Construction",date:dOff(36),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},{course:"Operating Systems",date:dOff(38),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Theory of Automata",date:dOff(40),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Elective",date:dOff(42),time:"02:00 PM",room:"D-501",duration:"2.5 hrs"}]
      }
    },
    "2024":{
      A:{
        S1:[{course:"Programming Fundamentals",date:dOff(-15),time:"09:00 AM",room:"D-101",duration:"2 hrs"},{course:"Calculus-I",date:dOff(-13),time:"11:00 AM",room:"D-201",duration:"2 hrs"},{course:"Discrete Structures",date:dOff(-11),time:"02:00 PM",room:"D-301",duration:"2 hrs"}],
        S2:[{course:"Programming Fundamentals",date:dOff(8),time:"09:00 AM",room:"D-101",duration:"2 hrs"},{course:"Calculus-I",date:dOff(10),time:"11:00 AM",room:"D-201",duration:"2 hrs"},{course:"English Composition",date:dOff(12),time:"02:00 PM",room:"D-102",duration:"1.5 hrs"}],
        FIN:[{course:"Programming Fundamentals",date:dOff(38),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Calculus-I",date:dOff(40),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Discrete Structures",date:dOff(42),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},{course:"English Composition",date:dOff(44),time:"09:00 AM",room:"D-301",duration:"2 hrs"}]
      },
      B:{
        S1:[{course:"Calculus-I",date:dOff(-14),time:"10:00 AM",room:"D-202",duration:"2 hrs"},{course:"Programming Fundamentals",date:dOff(-12),time:"09:00 AM",room:"D-102",duration:"2 hrs"}],
        S2:[{course:"Calculus-I",date:dOff(9),time:"10:00 AM",room:"D-202",duration:"2 hrs"},{course:"Programming Fundamentals",date:dOff(11),time:"09:00 AM",room:"D-102",duration:"2 hrs"},{course:"Islamic Studies",date:dOff(13),time:"02:00 PM",room:"D-201",duration:"1.5 hrs"}],
        FIN:[{course:"Calculus-I",date:dOff(39),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Programming Fundamentals",date:dOff(41),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Islamic Studies",date:dOff(43),time:"02:00 PM",room:"D-201",duration:"2 hrs"}]
      },
      C:{S1:[{course:"Intro to Computing",date:dOff(-13),time:"10:00 AM",room:"D-101",duration:"2 hrs"}],S2:[{course:"Intro to Computing",date:dOff(10),time:"10:00 AM",room:"D-101",duration:"2 hrs"}],FIN:[{course:"Intro to Computing",date:dOff(40),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"}]},
      D:{S1:[{course:"Linear Algebra",date:dOff(-12),time:"02:00 PM",room:"D-301",duration:"2 hrs"}],S2:[{course:"Linear Algebra",date:dOff(11),time:"02:00 PM",room:"D-301",duration:"2 hrs"},{course:"Applied Physics",date:dOff(13),time:"10:00 AM",room:"D-201",duration:"2 hrs"}],FIN:[{course:"Linear Algebra",date:dOff(41),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},{course:"Applied Physics",date:dOff(43),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"}]}
    },
    "2025":{
      A:{S1:[{course:"Machine Learning",date:dOff(-10),time:"10:00 AM",room:"D-402",duration:"2 hrs"},{course:"Deep Learning",date:dOff(-8),time:"02:00 PM",room:"D-401",duration:"2 hrs"},{course:"NLP",date:dOff(-6),time:"11:00 AM",room:"D-313",duration:"2 hrs"}],S2:[{course:"Machine Learning",date:dOff(12),time:"10:00 AM",room:"D-402",duration:"2 hrs"},{course:"Deep Learning",date:dOff(14),time:"02:00 PM",room:"D-401",duration:"2 hrs"},{course:"NLP",date:dOff(16),time:"11:00 AM",room:"D-313",duration:"2 hrs"}],FIN:[{course:"Machine Learning",date:dOff(42),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Deep Learning",date:dOff(44),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},{course:"NLP",date:dOff(46),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Computer Vision",date:dOff(48),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"}]},
      B:{S1:[{course:"Big Data",date:dOff(-9),time:"02:00 PM",room:"D-316",duration:"2 hrs"},{course:"Cloud Computing",date:dOff(-7),time:"10:00 AM",room:"D-501",duration:"2 hrs"}],S2:[{course:"Big Data",date:dOff(13),time:"02:00 PM",room:"D-316",duration:"2 hrs"},{course:"Cloud Computing",date:dOff(15),time:"10:00 AM",room:"D-501",duration:"2 hrs"},{course:"Cyber Security",date:dOff(17),time:"09:00 AM",room:"D-302",duration:"2 hrs"}],FIN:[{course:"Big Data",date:dOff(43),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},{course:"Cloud Computing",date:dOff(45),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Cyber Security",date:dOff(47),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"}]},
      C:{S1:[{course:"Mobile App Dev",date:dOff(-8),time:"10:00 AM",room:"D-Lab2",duration:"1.5 hrs"}],S2:[{course:"Mobile App Dev",date:dOff(14),time:"10:00 AM",room:"D-Lab2",duration:"1.5 hrs"},{course:"Game Dev",date:dOff(16),time:"02:00 PM",room:"D-401",duration:"2 hrs"}],FIN:[{course:"Mobile App Dev",date:dOff(44),time:"10:00 AM",room:"D-Audi",duration:"2.5 hrs"},{course:"Game Dev",date:dOff(46),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"}]},
      D:{S1:[{course:"Blockchain",date:dOff(-7),time:"09:00 AM",room:"D-402",duration:"2 hrs"}],S2:[{course:"Blockchain",date:dOff(15),time:"09:00 AM",room:"D-402",duration:"2 hrs"},{course:"AR/VR Dev",date:dOff(17),time:"11:00 AM",room:"D-501",duration:"2 hrs"},{course:"IoT",date:dOff(19),time:"02:00 PM",room:"D-316",duration:"2 hrs"}],FIN:[{course:"Blockchain",date:dOff(45),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"AR/VR Dev",date:dOff(47),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"IoT",date:dOff(49),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"}]}
    },
    "2026":{
      A:{S1:[{course:"Senior Project I",date:dOff(-5),time:"10:00 AM",room:"D-502",duration:"2 hrs"},{course:"Research Methods",date:dOff(-3),time:"09:00 AM",room:"D-313",duration:"2 hrs"}],S2:[{course:"Senior Project I",date:dOff(18),time:"10:00 AM",room:"D-502",duration:"2 hrs"},{course:"Tech Entrepreneurship",date:dOff(20),time:"02:00 PM",room:"D-401",duration:"2 hrs"}],FIN:[{course:"Senior Project I",date:dOff(48),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Research Methods",date:dOff(50),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Tech Entrepreneurship",date:dOff(52),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"}]},
      B:{S1:[{course:"Capstone Design",date:dOff(-4),time:"10:00 AM",room:"D-502",duration:"2 hrs"}],S2:[{course:"Capstone Design",date:dOff(19),time:"10:00 AM",room:"D-502",duration:"2 hrs"},{course:"Industry Seminar",date:dOff(21),time:"02:30 PM",room:"D-Audi",duration:"1.5 hrs"}],FIN:[{course:"Capstone Design",date:dOff(49),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Industry Seminar",date:dOff(51),time:"02:30 PM",room:"D-Audi",duration:"2 hrs"}]},
      C:{S1:[{course:"Final Year Project",date:dOff(-3),time:"09:00 AM",room:"D-Lab1",duration:"2 hrs"}],S2:[{course:"Final Year Project",date:dOff(20),time:"09:00 AM",room:"D-Lab1",duration:"2 hrs"},{course:"Business Communication",date:dOff(22),time:"10:00 AM",room:"D-201",duration:"1.5 hrs"}],FIN:[{course:"Final Year Project",date:dOff(50),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Business Communication",date:dOff(52),time:"10:00 AM",room:"D-Audi",duration:"2 hrs"}]},
      D:{S1:[{course:"Professional Ethics",date:dOff(-2),time:"11:30 AM",room:"D-302",duration:"1.5 hrs"}],S2:[{course:"Professional Ethics",date:dOff(21),time:"11:30 AM",room:"D-302",duration:"1.5 hrs"},{course:"Project Management",date:dOff(23),time:"02:00 PM",room:"D-313",duration:"2 hrs"}],FIN:[{course:"Professional Ethics",date:dOff(51),time:"11:30 AM",room:"D-Audi",duration:"2 hrs"},{course:"Project Management",date:dOff(53),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"}]}
    }
  },
  AI:{
    "2023":{
      A:{S1:[{course:"Machine Learning",date:dOff(-20),time:"10:00 AM",room:"D-402",duration:"2 hrs"},{course:"Data Mining",date:dOff(-18),time:"02:00 PM",room:"D-313",duration:"2 hrs"},{course:"Deep Learning",date:dOff(-16),time:"09:00 AM",room:"D-401",duration:"2 hrs"}],S2:[{course:"Machine Learning",date:dOff(5),time:"10:00 AM",room:"D-402",duration:"2 hrs"},{course:"Data Mining",date:dOff(7),time:"02:00 PM",room:"D-313",duration:"2 hrs"},{course:"Computer Vision",date:dOff(9),time:"11:00 AM",room:"D-402",duration:"2 hrs"}],FIN:[{course:"Machine Learning",date:dOff(35),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Data Mining",date:dOff(37),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},{course:"Deep Learning",date:dOff(39),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Computer Vision",date:dOff(41),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"}]},
      B:{S1:[{course:"NLP",date:dOff(-19),time:"09:00 AM",room:"D-316",duration:"2 hrs"},{course:"Reinforcement Learning",date:dOff(-17),time:"10:00 AM",room:"D-401",duration:"2 hrs"}],S2:[{course:"NLP",date:dOff(6),time:"09:00 AM",room:"D-316",duration:"2 hrs"},{course:"Reinforcement Learning",date:dOff(8),time:"10:00 AM",room:"D-401",duration:"2 hrs"},{course:"AI Ethics",date:dOff(10),time:"02:00 PM",room:"D-313",duration:"1.5 hrs"}],FIN:[{course:"NLP",date:dOff(36),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Reinforcement Learning",date:dOff(38),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"AI Ethics",date:dOff(40),time:"02:00 PM",room:"D-Audi",duration:"2 hrs"},{course:"Robot Programming",date:dOff(42),time:"09:00 AM",room:"D-Lab2",duration:"2.5 hrs"}]},
      C:{S1:[{course:"Bayesian ML",date:dOff(-18),time:"10:00 AM",room:"D-501",duration:"2 hrs"}],S2:[{course:"Bayesian ML",date:dOff(7),time:"10:00 AM",room:"D-501",duration:"2 hrs"},{course:"Graph Neural Nets",date:dOff(9),time:"02:00 PM",room:"D-402",duration:"2 hrs"}],FIN:[{course:"Bayesian ML",date:dOff(37),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Graph Neural Nets",date:dOff(39),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"}]},
      D:{S1:[{course:"Generative AI",date:dOff(-17),time:"02:00 PM",room:"D-401",duration:"2 hrs"}],S2:[{course:"Generative AI",date:dOff(8),time:"02:00 PM",room:"D-401",duration:"2 hrs"},{course:"Agentic Systems",date:dOff(10),time:"10:00 AM",room:"D-402",duration:"2 hrs"},{course:"LLM Fine-tuning",date:dOff(12),time:"11:00 AM",room:"D-316",duration:"2 hrs"}],FIN:[{course:"Generative AI",date:dOff(38),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},{course:"Agentic Systems",date:dOff(40),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"LLM Fine-tuning",date:dOff(42),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"}]}
    },
    "2024":{
      A:{S1:[{course:"Intro to AI",date:dOff(-15),time:"10:00 AM",room:"D-201",duration:"2 hrs"},{course:"Python for AI",date:dOff(-13),time:"09:00 AM",room:"D-Lab1",duration:"1.5 hrs"}],S2:[{course:"Intro to AI",date:dOff(8),time:"10:00 AM",room:"D-201",duration:"2 hrs"},{course:"Stats for ML",date:dOff(10),time:"11:00 AM",room:"D-301",duration:"2 hrs"}],FIN:[{course:"Intro to AI",date:dOff(38),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Python for AI",date:dOff(40),time:"09:00 AM",room:"D-Lab1",duration:"2 hrs"},{course:"Stats for ML",date:dOff(42),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"}]},
      B:{S1:[{course:"Linear Algebra for AI",date:dOff(-14),time:"09:00 AM",room:"D-101",duration:"2 hrs"}],S2:[{course:"Linear Algebra for AI",date:dOff(9),time:"09:00 AM",room:"D-101",duration:"2 hrs"},{course:"Probability Theory",date:dOff(11),time:"02:00 PM",room:"D-201",duration:"2 hrs"}],FIN:[{course:"Linear Algebra for AI",date:dOff(39),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Probability Theory",date:dOff(41),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"}]},
      C:{S1:[{course:"Data Analysis",date:dOff(-13),time:"10:00 AM",room:"D-313",duration:"2 hrs"}],S2:[{course:"Data Analysis",date:dOff(10),time:"10:00 AM",room:"D-313",duration:"2 hrs"}],FIN:[{course:"Data Analysis",date:dOff(40),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"}]},
      D:{S1:[{course:"Foundations of AI",date:dOff(-12),time:"11:00 AM",room:"D-302",duration:"2 hrs"}],S2:[{course:"Foundations of AI",date:dOff(11),time:"11:00 AM",room:"D-302",duration:"2 hrs"}],FIN:[{course:"Foundations of AI",date:dOff(41),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"}]}
    },
    "2025":{
      A:{S1:[{course:"Advanced ML",date:dOff(-10),time:"10:00 AM",room:"D-402",duration:"2 hrs"},{course:"Transformer Models",date:dOff(-8),time:"02:00 PM",room:"D-401",duration:"2 hrs"}],S2:[{course:"Advanced ML",date:dOff(12),time:"10:00 AM",room:"D-402",duration:"2 hrs"},{course:"Transformer Models",date:dOff(14),time:"02:00 PM",room:"D-401",duration:"2 hrs"},{course:"MLOps",date:dOff(16),time:"09:00 AM",room:"D-316",duration:"2 hrs"}],FIN:[{course:"Advanced ML",date:dOff(42),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Transformer Models",date:dOff(44),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"},{course:"MLOps",date:dOff(46),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"}]},
      B:{S1:[{course:"Speech Recognition",date:dOff(-9),time:"10:00 AM",room:"D-313",duration:"2 hrs"}],S2:[{course:"Speech Recognition",date:dOff(13),time:"10:00 AM",room:"D-313",duration:"2 hrs"},{course:"AI for Healthcare",date:dOff(15),time:"02:00 PM",room:"D-501",duration:"2 hrs"}],FIN:[{course:"Speech Recognition",date:dOff(43),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"AI for Healthcare",date:dOff(45),time:"02:00 PM",room:"D-Audi",duration:"3 hrs"}]},
      C:{S1:[{course:"Robotics",date:dOff(-8),time:"09:00 AM",room:"D-Lab1",duration:"1.5 hrs"}],S2:[{course:"Robotics",date:dOff(14),time:"09:00 AM",room:"D-Lab1",duration:"1.5 hrs"},{course:"Autonomous Vehicles",date:dOff(16),time:"10:00 AM",room:"D-402",duration:"2 hrs"}],FIN:[{course:"Robotics",date:dOff(44),time:"09:00 AM",room:"D-Lab1",duration:"2.5 hrs"},{course:"Autonomous Vehicles",date:dOff(46),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"}]},
      D:{S1:[{course:"AI Security",date:dOff(-7),time:"09:00 AM",room:"D-302",duration:"2 hrs"}],S2:[{course:"AI Security",date:dOff(15),time:"09:00 AM",room:"D-302",duration:"2 hrs"},{course:"Explainable AI",date:dOff(17),time:"11:00 AM",room:"D-313",duration:"2 hrs"}],FIN:[{course:"AI Security",date:dOff(45),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Explainable AI",date:dOff(47),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"}]}
    },
    "2026":{
      A:{S1:[{course:"AI Research Project",date:dOff(-5),time:"10:00 AM",room:"D-502",duration:"2 hrs"}],S2:[{course:"AI Research Project",date:dOff(18),time:"10:00 AM",room:"D-502",duration:"2 hrs"},{course:"AI Seminar",date:dOff(20),time:"02:00 PM",room:"D-Audi",duration:"1.5 hrs"}],FIN:[{course:"AI Research Project",date:dOff(48),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"AI Seminar",date:dOff(50),time:"02:00 PM",room:"D-Audi",duration:"2 hrs"}]},
      B:{S1:[{course:"Capstone AI",date:dOff(-4),time:"09:00 AM",room:"D-Lab1",duration:"2 hrs"}],S2:[{course:"Capstone AI",date:dOff(19),time:"09:00 AM",room:"D-Lab1",duration:"2 hrs"},{course:"AI Product Dev",date:dOff(21),time:"10:00 AM",room:"D-501",duration:"2 hrs"}],FIN:[{course:"Capstone AI",date:dOff(49),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"AI Product Dev",date:dOff(51),time:"10:00 AM",room:"D-Audi",duration:"3 hrs"}]},
      C:{S1:[{course:"Final Project",date:dOff(-3),time:"09:00 AM",room:"D-502",duration:"2 hrs"}],S2:[{course:"Final Project",date:dOff(20),time:"09:00 AM",room:"D-502",duration:"2 hrs"},{course:"Innovation Lab",date:dOff(22),time:"02:00 PM",room:"D-Lab2",duration:"2 hrs"}],FIN:[{course:"Final Project",date:dOff(50),time:"09:00 AM",room:"D-Audi",duration:"3 hrs"},{course:"Innovation Lab",date:dOff(52),time:"02:00 PM",room:"D-Audi",duration:"2 hrs"}]},
      D:{S1:[{course:"Thesis Writing",date:dOff(-2),time:"11:00 AM",room:"D-313",duration:"2 hrs"}],S2:[{course:"Thesis Writing",date:dOff(21),time:"11:00 AM",room:"D-313",duration:"2 hrs"}],FIN:[{course:"Thesis Writing",date:dOff(51),time:"11:00 AM",room:"D-Audi",duration:"3 hrs"}]}
    }
  }
};

let _currentExamType=null;

function selectExamType(type){
  _currentExamType=type;
  // Update button active states
  document.getElementById('exbtn-s1').className='exam-type-btn'+(type==='S1'?' s1-active':'');
  document.getElementById('exbtn-s2').className='exam-type-btn'+(type==='S2'?' s2-active':'');
  document.getElementById('exbtn-fin').className='exam-type-btn'+(type==='FIN'?' fin-active':'');
  renderExamSchedule();
}

function examCountdown(date){
  const now=new Date();
  now.setHours(0,0,0,0);
  const d=new Date(date);d.setHours(0,0,0,0);
  const diff=Math.round((d-now)/(1000*60*60*24));
  if(diff<0) return{label:`${Math.abs(diff)}d ago`,cls:'past'};
  if(diff===0) return{label:'TODAY',cls:'soon'};
  if(diff<=3) return{label:`IN ${diff}d`,cls:'soon'};
  return{label:`IN ${diff}d`,cls:'upcoming'};
}

function renderExamSchedule(){
  const dept=document.getElementById('ex-dept').value;
  const batch=document.getElementById('ex-batch').value;
  const sec=document.getElementById('ex-sec').value;
  const type=_currentExamType;
  const out=document.getElementById('exam-out');
  if(!type){out.innerHTML='<div class="exam-no-data"><span style="font-family:VT323,monospace;font-size:42px;color:#b0d4b8;display:block;margin-bottom:8px">&#9956;</span>SELECT AN EXAM TYPE ABOVE</div>';return;}

  const data=(EXAM_SCHEDULE[dept]&&EXAM_SCHEDULE[dept][batch]&&EXAM_SCHEDULE[dept][batch][sec]&&EXAM_SCHEDULE[dept][batch][sec][type])||[];
  const typeNames={S1:'SESSIONAL 1',S2:'SESSIONAL 2',FIN:'FINAL EXAM'};
  const typeCls={S1:'s1',S2:'s2',FIN:'fin'};
  const tc=typeCls[type];

  if(!data.length){
    out.innerHTML=`<div class="exam-no-data"><span style="font-family:VT323,monospace;font-size:42px;color:#b0d4b8;display:block;margin-bottom:8px">&#9956;</span>NO EXAM DATA FOR THIS SELECTION</div>`;
    return;
  }

  const sorted=[...data].sort((a,b)=>a.date-b.date);
  const rows=sorted.map(e=>{
    const cd=examCountdown(e.date);
    return `<tr>
      <td><div class="exam-course-name">${e.course}</div></td>
      <td>
        <div class="exam-date-pill ${tc}">${dDay(e.date)}, ${dFmt(e.date)}</div>
        <div class="exam-time-txt">${e.time} &nbsp;ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·&nbsp; ${e.duration}</div>
        <span class="exam-countdown ${cd.cls}">${cd.label}</span>
      </td>
      <td><div class="exam-room-txt">${e.room}</div></td>
    </tr>`;
  }).join('');

  out.innerHTML=`
    <div class="exam-header-bar">
      <span class="exam-header-label">${dept} &nbsp;ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·&nbsp; BATCH ${batch} &nbsp;ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·&nbsp; SEC ${sec}</span>
      <span class="exam-header-badge ${tc}">${typeNames[type]}</span>
    </div>
    <div class="exam-table-wrap">
      <table class="exam-tbl">
        <thead><tr>
          <th class="${tc}" style="width:42%">COURSE</th>
          <th class="${tc}" style="width:38%">DATE &amp; TIME</th>
          <th class="${tc}" style="width:20%">ROOM</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

