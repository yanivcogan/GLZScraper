export const cn = (optionalClasses: {[key: string]: boolean})=>{
    return Array.from(Object.entries(optionalClasses)).filter(([i, v])=>{return v}).map(([i, v])=> i).join(" ")
};

export const toUpperEnglish = (s: string) =>{
    // noinspection NonAsciiCharacters
    const qwerty: {[id: string] : string} = {
        "/":"Q", "'":"W", "ק":"E", "ר":"R", "א":"T", "ט":"Y", "ו":"U", "ן":"I", "ם":"O", "פ":"P", "]":"[",
        "[":"]", "ש":"A", "ד":"S", "ג":"D", "כ":"F", "ע":"G", "י":"H", "ח":"J", "ל":"K", "ך":"L", "ף":";",
        "ז":"Z", "ס":"X", "ב":"C", "ה":"V", "נ":"B", "מ":"N", "צ":"M", "ת":",", "ץ":".",
    };
    return s.split("").map(char => {return qwerty[char] ? qwerty[char] : char}).join("").toUpperCase();
};

export const ISOtoShortDate = (datetime:string)=>{
    try{
        return datetime.split("T")[0]
    }catch(e){
        return JSON.stringify(datetime)
    }
}

export const dateStringToShortDate = (dateString:string) => {
    try{
        const asDate = new Date(dateString)
        return ISOtoShortDate(asDate.toISOString())
    }
    catch (e){
        return dateString
    }
}