type Info ={
	start: number;
	end: number;
	message: string;
	detail?: string;
}

const PRINT_LINES = 5;

export const prettyMessage = (filename: string|undefined, content: string, info: Info) => {
	let message = info.message;
	
	// if the warning/error is from the compiler, pretty print it
	if(filename){
		message += "\n\n" + filename + "\n\n";
	}else{
		message += "\n\n";
	}
	const preError = content.substring(0, info.start);
	const length = (info.end ?? info.start + 1) - info.start;
	const preLines = preError.split("\n"); 
	preLines.pop(); // get the lines before the warning/error

	const startLine = preLines.length; 
	const lines = content.split("\n");
	const line = lines[startLine].replaceAll("\t", " ");
	// get the index of the start of the line.
	const lineStart = preLines.reduce((acc, val) => acc + val.length, 0) + preLines.length; // add back the new line characters
	const startColumn = info.start - lineStart;
	const lineCountLength = startLine.toString().length;

	// print the line with the warning/error
	for(let i = Math.max(0, startLine - PRINT_LINES); i < startLine; i++){
		message += i.toString().padStart(lineCountLength, " ");
		message += "|";
		message += lines[i].replaceAll("\t", " ");
		message += "\n";
	}	
	// print the line with the warning/error
	message += startLine.toString();
	message += "|";
	message += line;
	message += "\n";
	// mark the warning/error range
	message += " ".repeat(Math.max(startColumn, 0) + lineCountLength + 1);
	message += "^".repeat(length);
	message += "\n";
	// print warning/error details centered in the warning/error range
	if(info.detail){
		message += " ".repeat(Math.floor(Math.max(startColumn +  lineCountLength + 1 +(length / 2) - (info.detail.length / 2), 0)));
		message += info.detail;
	}

	return message;
}