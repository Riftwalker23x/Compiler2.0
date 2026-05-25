/* Shared timetable data and helpers */
/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚Â
   TIMETABLE DATA
ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢Ãƒâ€šÃ‚Â */
const TT={CS:{"2023":{A:{Monday:[{c:"Data Structures",l:"D-201",t:"08:30-09:50"},{c:"Digital Logic Design",l:"D-301",t:"10:00-11:20"},{c:"Calculus-II",l:"D-101",t:"01:00-02:20"}],Tuesday:[{c:"OOP [G-I]",l:"D-Lab1",t:"08:30-09:50"},{c:"Islamic Studies",l:"D-201",t:"11:30-12:50"}],Wednesday:[{c:"Data Structures",l:"D-201",t:"10:00-11:20"},{c:"Communication Skills",l:"D-302",t:"01:00-02:20"}],Thursday:[{c:"DLD Lab",l:"D-Lab2",t:"08:30-09:50"},{c:"Linear Algebra",l:"D-101",t:"11:30-12:50"}],Friday:[{c:"Friday Lecture",l:"D-Audi",t:"01:30-02:20"}]},B:{Monday:[{c:"Programming Fundamentals",l:"D-101",t:"08:30-09:50"},{c:"Calculus-I",l:"D-201",t:"10:00-11:20"}],Tuesday:[{c:"MLOPs [G-I]",l:"D-401",t:"10:00-11:20"},{c:"Entre",l:"D-313",t:"11:30-12:50"},{c:"Fund of SPM [G-I]",l:"D-316",t:"01:00-02:20"},{c:"Agentic AI [G-I]",l:"D-402",t:"01:00-02:20"}],Wednesday:[{c:"OOP",l:"D-Lab1",t:"10:00-11:20"}],Thursday:[{c:"Discrete Structures",l:"D-301",t:"08:30-09:50"}],Friday:[{c:"Pakistan Studies",l:"D-201",t:"11:00-12:00"}]},C:{Monday:[{c:"Web Engineering",l:"D-301",t:"10:00-11:20"}],Tuesday:[{c:"Database Systems",l:"D-313",t:"08:30-09:50"}],Wednesday:[{c:"Computer Networks",l:"D-402",t:"01:00-02:20"}],Thursday:[{c:"Software Engineering",l:"D-316",t:"11:30-12:50"}],Friday:[]},D:{Monday:[{c:"Compiler Construction",l:"D-401",t:"01:00-02:20"}],Tuesday:[{c:"Operating Systems",l:"D-302",t:"10:00-11:20"}],Wednesday:[],Thursday:[{c:"Theory of Automata",l:"D-201",t:"08:30-09:50"}],Friday:[{c:"Elective",l:"D-501",t:"11:30-12:50"}]}},"2024":{A:{Monday:[{c:"Programming Fundamentals",l:"D-101",t:"08:30-09:50"},{c:"Calculus-I",l:"D-201",t:"10:00-11:20"}],Tuesday:[{c:"PF Lab",l:"D-Lab1",t:"08:30-09:50"}],Wednesday:[{c:"Discrete Structures",l:"D-301",t:"11:30-12:50"}],Thursday:[{c:"English Composition",l:"D-102",t:"10:00-11:20"}],Friday:[]},B:{Monday:[{c:"Calculus-I",l:"D-202",t:"10:00-11:20"}],Tuesday:[{c:"Programming Fundamentals",l:"D-102",t:"08:30-09:50"}],Wednesday:[{c:"PF Lab",l:"D-Lab2",t:"08:30-09:50"}],Thursday:[{c:"Islamic Studies",l:"D-201",t:"11:30-12:50"}],Friday:[]},C:{Monday:[],Tuesday:[{c:"Intro to Computing",l:"D-101",t:"10:00-11:20"}],Wednesday:[],Thursday:[],Friday:[]},D:{Monday:[{c:"Linear Algebra",l:"D-301",t:"01:00-02:20"}],Tuesday:[],Wednesday:[{c:"Applied Physics",l:"D-201",t:"10:00-11:20"}],Thursday:[],Friday:[]}},"2025":{A:{Monday:[{c:"Machine Learning",l:"D-402",t:"10:00-11:20"}],Tuesday:[{c:"Deep Learning",l:"D-401",t:"01:00-02:20"}],Wednesday:[{c:"CV Lab",l:"D-Lab1",t:"08:30-09:50"}],Thursday:[{c:"NLP",l:"D-313",t:"11:30-12:50"}],Friday:[]},B:{Monday:[{c:"Big Data",l:"D-316",t:"01:00-02:20"}],Tuesday:[{c:"Cloud Computing",l:"D-501",t:"10:00-11:20"}],Wednesday:[],Thursday:[{c:"Cyber Security",l:"D-302",t:"08:30-09:50"}],Friday:[]},C:{Monday:[],Tuesday:[{c:"Mobile App Dev",l:"D-Lab2",t:"10:00-11:20"}],Wednesday:[{c:"Game Dev",l:"D-401",t:"01:00-02:20"}],Thursday:[],Friday:[]},D:{Monday:[{c:"Blockchain",l:"D-402",t:"08:30-09:50"}],Tuesday:[],Wednesday:[{c:"AR/VR Dev",l:"D-501",t:"11:30-12:50"}],Thursday:[{c:"IoT",l:"D-316",t:"01:00-02:20"}],Friday:[]}},"2026":{A:{Monday:[{c:"Senior Project I",l:"D-502",t:"10:00-11:20"}],Tuesday:[{c:"Research Methods",l:"D-313",t:"08:30-09:50"}],Wednesday:[],Thursday:[{c:"Tech Entrepreneurship",l:"D-401",t:"01:00-02:20"}],Friday:[]},B:{Monday:[],Tuesday:[{c:"Capstone Design",l:"D-502",t:"10:00-11:20"}],Wednesday:[{c:"Industry Seminar",l:"D-Audi",t:"02:30-03:30"}],Thursday:[],Friday:[]},C:{Monday:[{c:"Final Year Project",l:"D-Lab1",t:"08:30-09:50"}],Tuesday:[],Wednesday:[],Thursday:[{c:"Business Communication",l:"D-201",t:"10:00-11:20"}],Friday:[]},D:{Monday:[],Tuesday:[{c:"Professional Ethics",l:"D-302",t:"11:30-12:50"}],Wednesday:[{c:"Project Management",l:"D-313",t:"01:00-02:20"}],Thursday:[],Friday:[]}}},AI:{"2023":{A:{Monday:[{c:"Machine Learning",l:"D-402",t:"10:00-11:20"},{c:"Data Mining",l:"D-313",t:"01:00-02:20"}],Tuesday:[{c:"Deep Learning",l:"D-401",t:"08:30-09:50"}],Wednesday:[{c:"ML Lab",l:"D-Lab1",t:"10:00-11:20"}],Thursday:[{c:"Computer Vision",l:"D-402",t:"11:30-12:50"}],Friday:[]},B:{Monday:[{c:"NLP",l:"D-316",t:"08:30-09:50"}],Tuesday:[{c:"Reinforcement Learning",l:"D-401",t:"10:00-11:20"},{c:"AI Ethics",l:"D-313",t:"01:00-02:20"}],Wednesday:[],Thursday:[{c:"Robot Programming",l:"D-Lab2",t:"08:30-09:50"}],Friday:[]},C:{Monday:[],Tuesday:[{c:"Bayesian ML",l:"D-501",t:"10:00-11:20"}],Wednesday:[{c:"Graph Neural Nets",l:"D-402",t:"01:00-02:20"}],Thursday:[],Friday:[]},D:{Monday:[{c:"Generative AI",l:"D-401",t:"01:00-02:20"}],Tuesday:[],Wednesday:[{c:"Agentic Systems",l:"D-402",t:"10:00-11:20"}],Thursday:[{c:"LLM Fine-tuning",l:"D-316",t:"11:30-12:50"}],Friday:[]}},"2024":{A:{Monday:[{c:"Intro to AI",l:"D-201",t:"10:00-11:20"}],Tuesday:[{c:"Python for AI",l:"D-Lab1",t:"08:30-09:50"}],Wednesday:[{c:"Stats for ML",l:"D-301",t:"11:30-12:50"}],Thursday:[],Friday:[]},B:{Monday:[{c:"Linear Algebra for AI",l:"D-101",t:"08:30-09:50"}],Tuesday:[{c:"AI Lab",l:"D-Lab2",t:"10:00-11:20"}],Wednesday:[],Thursday:[{c:"Probability Theory",l:"D-201",t:"01:00-02:20"}],Friday:[]},C:{Monday:[],Tuesday:[],Wednesday:[{c:"Data Analysis",l:"D-313",t:"10:00-11:20"}],Thursday:[],Friday:[]},D:{Monday:[{c:"Foundations of AI",l:"D-302",t:"11:30-12:50"}],Tuesday:[],Wednesday:[],Thursday:[],Friday:[]}},"2025":{A:{Monday:[{c:"Advanced ML",l:"D-402",t:"10:00-11:20"}],Tuesday:[{c:"Transformer Models",l:"D-401",t:"01:00-02:20"}],Wednesday:[],Thursday:[{c:"MLOps",l:"D-316",t:"08:30-09:50"}],Friday:[]},B:{Monday:[],Tuesday:[{c:"Speech Recognition",l:"D-313",t:"10:00-11:20"}],Wednesday:[{c:"AI for Healthcare",l:"D-501",t:"01:00-02:20"}],Thursday:[],Friday:[]},C:{Monday:[{c:"Robotics",l:"D-Lab1",t:"08:30-09:50"}],Tuesday:[],Wednesday:[],Thursday:[{c:"Autonomous Vehicles",l:"D-402",t:"10:00-11:20"}],Friday:[]},D:{Monday:[],Tuesday:[{c:"AI Security",l:"D-302",t:"08:30-09:50"}],Wednesday:[{c:"Explainable AI",l:"D-313",t:"11:30-12:50"}],Thursday:[],Friday:[]}},"2026":{A:{Monday:[{c:"AI Research Project",l:"D-502",t:"10:00-11:20"}],Tuesday:[{c:"AI Seminar",l:"D-Audi",t:"01:00-02:20"}],Wednesday:[],Thursday:[],Friday:[]},B:{Monday:[],Tuesday:[{c:"Capstone AI",l:"D-Lab1",t:"08:30-09:50"}],Wednesday:[{c:"AI Product Dev",l:"D-501",t:"10:00-11:20"}],Thursday:[],Friday:[]},C:{Monday:[],Tuesday:[],Wednesday:[{c:"Final Project",l:"D-502",t:"08:30-09:50"}],Thursday:[{c:"Innovation Lab",l:"D-Lab2",t:"01:00-02:20"}],Friday:[]},D:{Monday:[{c:"Thesis Writing",l:"D-313",t:"11:30-12:50"}],Tuesday:[],Wednesday:[],Thursday:[],Friday:[]}}}};

const BLOCK_FLOORS={
  C:{1:["C-101","C-102","C-103"],2:["C-201","C-202","C-203"],3:["C-301","C-302","C-303"]},
  D:{1:["D-101","D-102"],2:["D-201","D-202"],3:["D-301","D-302","D-313","D-316"],4:["D-401","D-402"],5:["D-501","D-502"],Lab:["D-Lab1","D-Lab2"],Audi:["D-Audi"]}
};

const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday"];
const DAYNAMES=["SUN","MON","TUE","WED","THU","FRI","SAT"];
const SLOTS=["08:30-09:50","10:00-11:20","11:30-12:50","01:00-02:20","02:30-03:30"];

/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Time helpers ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */
// University slots use 12-hr style: "01:00" = 1 PM, "08:30" = 8 AM
// Hours 1ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ6 are treated as PM (13ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ18). Hours 7ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ12 are AM/noon as-is.
function slotToMinutes(timeStr){
  const[hh,mm]=timeStr.split(":").map(Number);
  const hour=(hh>=1&&hh<=6)?hh+12:hh;
  return hour*60+mm;
}

function fmtTime(timeStr){
  // "01:00" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ "1:00 PM"   "08:30" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ "8:30 AM"
  const[hh,mm]=timeStr.split(":").map(Number);
  const isPM=(hh>=1&&hh<=6)||(hh===12);
  const hour=(hh>=1&&hh<=6)?hh:(hh>12?hh-12:hh);
  const ampm=isPM?'PM':'AM';
  return `${hour}:${mm.toString().padStart(2,'0')} ${ampm}`;
}

function fmtSlot(slot){
  const[s,e]=slot.split("-");
  return `${fmtTime(s)}ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ${fmtTime(e)}`;
}

function nowMinutes(){
  const n=new Date();return n.getHours()*60+n.getMinutes();
}

function getCurrentSlot(){
  const cur=nowMinutes();
  for(const s of SLOTS){
    const[start,end]=s.split("-");
    if(cur>=slotToMinutes(start)&&cur<=slotToMinutes(end)) return s;
  }
  return null;
}

// Returns only slots whose end time is still in the future (includes current slot)
function getUpcomingSlots(){
  const cur=nowMinutes();
  return SLOTS.filter(s=>slotToMinutes(s.split("-")[1])>cur);
}

// Returns per-slot schedule for a room on a given day (upcoming slots only)
function getRoomSlotInfo(room,day){
  return getUpcomingSlots().map(slot=>{
    let occupiedBy=null;
    ['CS','AI'].forEach(dep=>{
      Object.entries(TT[dep]).forEach(([bat,batches])=>{
        Object.entries(batches).forEach(([sec,sections])=>{
          (sections[day]||[]).forEach(c=>{
            if(c.l===room&&c.t===slot){
              occupiedBy={course:c.c,dept:dep,batch:bat,section:sec};
            }
          });
        });
      });
    });
    return{slot,occupiedBy};
  });
}
