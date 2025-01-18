type Info ={
	start: number;
	end: number;
	message: string;
	detail?: string;
}

export const prettyMessage = (filename: string|undefined, content: string, info: Info) => {
	let message = info.message;
	
	// if the infoor is from the compiler, pretty print it
	if(filename){
		message += filename + "\n\n";
	}else{
		message += "\n\n";
	}
	const preError = content.substring(0, info.start);
	const length = (info.end ?? info.start + 1) - info.start;
	const preLines = preError.split("\n"); 
	preLines.pop(); // get the lines before the infoor

	const startLine = preLines.length; 
	const lines = content.split("\n");
	const line = lines[startLine].replaceAll("\t", " ");
	// get the index of the start of the line.
	const lineStart = preLines.reduce((acc, val) => acc + val.length, 0) + preLines.length; // add back the new line characters
	const startColumn = info.start - lineStart;
	const lineCountLength = startLine.toString().length;

	// print the lines before the infoor
	if(startLine > 1){
		message += (startLine - 2).toString().padStart(lineCountLength, " ");
		message += "|";
		message += lines[startLine - 2].replaceAll("\t", " ");
		message += "\n";
	}
	if(startLine > 0){
		message += (startLine - 1).toString().padStart(lineCountLength, " ");
		message += "|";
		message += lines[startLine - 1].replaceAll("\t", " ");
		message += "\n";
	}
	// print the line with the infoor
	message += startLine.toString();
	message += "|";
	message += line;
	message += "\n";
	// mark the infoor range
	message += " ".repeat(Math.max(startColumn, 0) + lineCountLength + 1);
	message += "^".repeat(length);
	message += "\n";
	// print infoor details centered in the infoor range
	if(info.detail){
		message += " ".repeat(Math.floor(Math.max(startColumn +  lineCountLength + 1 +(length / 2) - (info.detail.length / 2), 0)));
		message += info.detail;
	}

	return message;
}