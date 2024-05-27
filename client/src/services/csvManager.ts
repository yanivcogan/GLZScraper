import papa from "papaparse";

const generateCSV:(data:any[][]) => string = (data:any[][]) => {
    return papa.unparse(data);
};

export const downloadCSV = (filename:string, content:any[][]) => {
    const blob = new Blob(["\uFEFF" + generateCSV(content)], {type: "text/csv;charset=utf-8,%EF%BB%BF"});
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename + ".csv";
    link.innerHTML = "Click here to download the file";
    document.body.appendChild(link);
    link.click();
    if(link.parentElement) {link.parentElement.removeChild(link)}
};