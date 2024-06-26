// ==UserScript==
// @name         更好的智学网
// @namespace    https://github.com/qiguaideaaaa/BetterZhixue
// @version      0.5
// @description  让智学网变得更好
// @author       QiguaiAAA
// @connect      self
// @match        https://www.zhixue.com/zhixuebao/zhixuebao/transcript/analysis/main/*
// @match        https://www.zhixue.com/activitystudy/web-report/index.html*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=www.zhixue.com
// @grant        GM.xmlHttpRequest

// ==/UserScript==

(function () {
    'use strict';

    //平均分计算使用
    var rawMeanData = document.getElementsByClassName("total");
    var rawAnswerData = document.getElementsByClassName("ml20");
    var REGEX_FULL = /满分(\d+)\.(\d+)/;
    var REGEX_MEAN = /本题班级得分率<i>(\d+)/;
    var ACCURACY = 100;

    //通信需使用
    var XTOKEN = "";
    var MD5_LOAD_URL = "https://blueimp.github.io/JavaScript-MD5/js/md5.js";
    var API_GET_TOKEN_URL = "https://www.zhixue.com/container/app/token/getToken";
    var API_GET_REPORT_URL = "https://www.zhixue.com/zhixuebao/report/exam/getReportMain?examId=";
    var API_GET_SUBJECT_DIAGNOSIS = "https://www.zhixue.com/zhixuebao/report/exam/getSubjectDiagnosis?examId=";
    var AIP_GET_LEVEL_TREND = "https://www.zhixue.com/zhixuebao/report/exam/getLevelTrend?pageIndex=1&pageSize=1&examId=";
    var examid = sessionStorage.getItem('zxbReportExamId');

    //智学网通信验证需使用
    var timeDifference = 0;
    var BICODE = "0001";
    var PASSWORD = "iflytek!@#123student";

    //界面
    var DISPLAY_MEAN_SCORE_FONT_SIZE = "14px";
    var DISPLAY_MEAN_SCORE_SPACING = 3;
    var displayMeanScoreSpacingStr = "";

    //其他常量
    var COOKIE_EXAMID_LOC = "zxbReportExamId";
    var SPACE = "&nbsp;";
    var CHECK_SPACE_MILLISECOND = 1500;

    //DEBUG
    var ENABLE_DEBUG = false;

    ready();

    function ready() {
        for(let i =0;i<DISPLAY_MEAN_SCORE_SPACING;i++){
            displayMeanScoreSpacingStr +=SPACE;
        }
        //加载外部库
        let script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.src = MD5_LOAD_URL;
        document.documentElement.appendChild(script);
        script.onload = function () {
            getToken();
        }
    }

    //获取通信Token
    function getToken() {
        GM.xmlHttpRequest({
            url: API_GET_TOKEN_URL,
            method: "GET",
            headers: {
                "content-type": "application/json",
                "user-agent": navigator.userAgent,
            },
            responseType: "json",
            onload: function (response) {
                if (response.status === 200) {
                    const data = response.response;
                    debugLog(data);
                    XTOKEN = data.result;
                }
                main();
            }
        });
    }

    function main() {
        getMeanScore();
        setInterval(function () {
            let div = document.getElementsByClassName("general")[0];
            if ((div == undefined) || (div == null) || (div.length == 0)||(!checkMark(div))) {
                return;
            }
            realTotalScore(div);
        }, CHECK_SPACE_MILLISECOND); 
        setInterval(function () {
            var div = document.getElementsByClassName("subject_analysis_div")[0];
            if ((div == undefined) || (div == null) || (div.length == 0)||(!checkMark(div))) {
                return;
            }
            calculateSeat();
        }, CHECK_SPACE_MILLISECOND);
    }

    //计算折后的分数
    function realTotalScore(){
        var paper = undefined;
        var total = 0.0;
        var full = 0.0;
        getPaper();

        function getPaper(){
            updateExamid();
            sendRequest(
                API_GET_REPORT_URL+examid,
                "GET",
                function(response){
                    if(!(response.status === 200)){
                        return;
                    }
                    paper = response.response.result.paperList;
                    calculate();
                }
            )
        }

        function calculate(){
            for(let i =0;i<paper.length;i++){
                let thePaper = paper[i];
                let sub = thePaper.title;
                let fullScore = thePaper.standardScore;
                let score = thePaper.userScore;
                let value = getValue(sub);
                total = total + (score*100)*(value*10);
                full = full + (fullScore*100)*(value*10);
                
            }
            debugLog("折分后总分:"+total/1000+" of "+ full/1000);
            display();
        }

        function display(){
            let div = document.getElementsByClassName("general")[0];
            if(!div){
                return;
            }
            let place = div.childNodes[2].childNodes[0];
            let fullPlace = place.getElementsByClassName("specific")[0];
            fullPlace.innerHTML = "折分前" + fullPlace.innerHTML + SPACE+SPACE+"折分后满分 "+full/1000;
            let span = document.createElement("span");
            span.setAttribute("class", "bold");
            span.innerHTML = "折后:"+total/1000+"分";
            place.insertBefore(span, place.childNodes[1]);
        }

        function getValue(sub){
            switch(sub){
                case "语文":
                    return 1.0;
                case "数学":
                    return 1.0;
                case "英语":
                    return 1.0;
                case "物理":
                    return 0.9;
                case "化学":
                    return 0.6;
                case "历史":
                    return 0.5;
                case "政治":
                    return 0.5;
                case "地理":
                    return 0.3;
                case "生物":
                    return 0.3;
            }
            return 1.0;
        }
    }

    function updateExamid(){
        examid = sessionStorage.getItem(COOKIE_EXAMID_LOC);
    }

    function getMeanScore() {

        if (rawMeanData.length == 0) {
            return;
        }

        let meanScore = 0.0;
        let choiceProblemMeanScore = 0.0;
        let choiceProblemExist = false;

        for (var i = 0; i < rawMeanData.length; i++) {
            var data = rawMeanData[i].innerHTML;
            displayAdvicedThing(rawMeanData[i]);
            var rawFullScoreInt = parseInt(REGEX_FULL.exec(data)[1]);
            var rawFullScoreFloat = parseInt(REGEX_FULL.exec(data)[2]);
            var meanRate = parseInt(REGEX_MEAN.exec(data)[1]);

            var fullScore = rawFullScoreInt * ACCURACY + rawFullScoreFloat;
            if(isChoiceProblem(i)){
                choiceProblemMeanScore += fullScore*meanRate;
                choiceProblemExist = true;
            }

            meanScore += fullScore * meanRate;

            debugLog("第"+(i+1)+"题，满分"+fullScore/ACCURACY+"分，班级平均得分率"+meanRate+"%");

        }

        if(!choiceProblemExist) choiceProblemMeanScore = -1.0;

        debugLog("平均分:" + meanScore / (ACCURACY*100));
        
        displayMeanScore(meanScore,choiceProblemMeanScore);

        //在页面上显示计算结果
        function displayMeanScore(fullMeanScore,choiceMeanScore) {
            var div = document.getElementById("question_parsing_containter");
            var ele = document.createElement("p");
            if(choiceMeanScore >=0){
                ele.innerHTML += ("班级客观题平均分:" + choiceMeanScore / (ACCURACY*100) + "分"+displayMeanScoreSpacingStr);
                ele.innerHTML += ("班级主观题平均分:" + (fullMeanScore - choiceMeanScore) / (ACCURACY*100) + "分"+displayMeanScoreSpacingStr);
            }
            ele.innerHTML += ("班级平均分:" + fullMeanScore / (ACCURACY*100) + "分");
            ele.style.textAlign = "center";
            ele.style.fontSize = DISPLAY_MEAN_SCORE_FONT_SIZE;
            div.insertBefore(ele, div.firstChild);
    
        }

        function displayAdvicedThing(data) {
            var newHTML = data.childNodes[3].textContent.trim();
            if (newHTML != "") {
                data.innerHTML = newHTML;
            }
        }
    }

    function isChoiceProblem(problemId){
        if(problemId >=rawAnswerData.length) return false;
        let ans = rawAnswerData[problemId].innerHTML.charAt(2);
        if(ans>='A' && ans <='Z') return true;
        else return false;
    }

    function debugLog(msg){
        if(!ENABLE_DEBUG) return;
        console.debug(msg);
    }

    //来自智学网
    function getGuid() {
        let s = []
        let hexDigits = '0123456789abcdef'
        for (let i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1)
        }
        s[14] = '4'
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1)
        s[8] = s[13] = s[18] = s[23] = '-'

        return s.join('')
    }

    //来自智学网
    function getAuth() {
        var authguid = getGuid();
        var authtimestamp = new Date().getTime() - timeDifference;
        var authtokenOrigin = authguid + authtimestamp + PASSWORD;
        return {
            authguid: authguid,
            authtimestamp: authtimestamp,
            authbizcode: BICODE,
            authtokenOrigin: authtokenOrigin,
            authtoken: md5(authtokenOrigin)
        }
    }

    //对于已经检查过的雷达图，添加标记以防重复检查
    function checkMark(ele) {
        let element = ele;
        let mark = element.getElementsByClassName("marked");
        if (!((mark == undefined) || (mark == null) || (mark.length == 0))) {
            return false;
        }
        mark = undefined;
        mark = document.createElement("div");
        mark.setAttribute("class", "marked");
        element.appendChild(mark);
        return true;
    }

    //计算班级排名
    function calculateSeat() {
        updateExamid();
        var marks;
        var total = 0;
        var analysis = document.getElementsByClassName("subject_analysis_div")[0].getElementsByClassName("guideWapper");

        getAnalysisData();

        function getAnalysisData() {
            sendRequest(
                API_GET_SUBJECT_DIAGNOSIS + examid,
                "GET",
                function (response) {
                    const data = response.response;
                    if (response.status == 200) {
                        marks = data.result.list;
                        getTotalData();
                    }
                });
        }

        function getTotalData() {
            sendRequest(
                AIP_GET_LEVEL_TREND + examid,
                "GET",
                function (response) {
                    const data = response.response;
                    if (response.status == 200) {
                        debugLog(data);
                        total = data.result.list[0].dataList[0].totalNum;
                        core();
                    }
                }
            )
        }

        function core() {
            for (var i = 0; i < analysis.length; i++) {
                var div = analysis[i].childNodes[0];
                var isSPAN = false;
                if (div.childNodes[0].tagName == "SPAN") {
                    div = div.childNodes[0];
                    isSPAN = true;
                }
                let value;
                for (var j = 0; j < marks.length; j++) {
                    if (marks[j].subjectName == div.innerHTML) {
                        value = parseFloat(marks[j].myRank);
                        console.log(value + "," + div.innerHTML);
                        break;
                    }
                }
                if (value == undefined) {
                    continue;
                }
                let text = getSeat(value);

                if (text == -1) {
                    continue;
                }
                if (isSPAN) {
                    div.innerHTML = div.innerHTML + "(班级第" + text + "名) 排名等级：" + getGrade(text);
                    continue;
                }
                div.innerHTML = div.innerHTML + "(班级第" + text + "名)<br/>排名等级：" + getGrade(text);
            }
        }

        //智学网rank计算=(排名-1)/(总人数-1)，再四舍五入
        function getSeat(value) {
            //i = 排名-1
            for (let i = 0; i < total; i++) {
                let startRank = i * 100 / (total - 1);
                let rank = parseFloat(startRank.toFixed(1));
                debugLog("尝试rank:"+rank+"此时value:"+value);
                debugLog(rank == value);
                if (!(rank == value)) {
                    continue;
                }
                return i + 1;
            }
            return -1;
        }

        function getGrade(seat) {
            let rank = (total - (seat - 1)) / total;
            if (rank >= 0.85) {
                return "A";
            } else if ((rank < 0.85) && (rank >= 0.55)) {
                return "B";
            } else if ((rank < 0.55) && (rank >= 0.2)) {
                return "C";
            } else if ((rank < 0.2) && (rank >= 0.05)) {
                return "D";
            } else if ((rank < 0.05) && (rank >= 0.0)) {
                return "E";
            }
            return "?";
        }
    }

    //发送网络请求
    function sendRequest(url, method, onload) {
        let auth = getAuth();
        return GM.xmlHttpRequest({
            url: url,
            method: method,
            headers: {
                "content-type": "application/json",
                "authguid": auth.authguid,
                "authtimestamp": auth.authtimestamp,
                "authbizcode": auth.authbizcode,
                "authtoken": auth.authtoken,
                "User-Agent": navigator.userAgent,
                "X-Trans-Ready": true,
                "XToken": XTOKEN
            },
            responseType: "json",
            onload: onload,
        });
    }

})();
