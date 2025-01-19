type Info ={
	start: number;
	end: number;
	message: string;
	detail?: string;
}

const MAX_WIDTH = 80;

export type FormattedLocation = {text: string, startColumn: number};

function overflowLine(line: string) {
	if(!line){
		return "";
	}
	if(line.length > MAX_WIDTH){
		return line.substring(0, MAX_WIDTH - 3) + "...";
	}
	return line;
}

function chunkSubstr(str: string, maxLine?: number) {
	const numChunks = Math.ceil(str.length / MAX_WIDTH)
	const chunks = new Array(numChunks)
  
	for (let i = 0; i < numChunks; ++i) {
	  	chunks[i] = str.substring(i * MAX_WIDTH, (i + 1) * MAX_WIDTH)
	}
	if(maxLine){
		chunks.splice(maxLine, chunks.length - (maxLine - 1));
		chunks[maxLine] = overflowLine(chunks[maxLine]);
	}
	return chunks.filter(c => c).join("\n");
}


export const printLocation = (filename: string|undefined, content: string,start: number, end:number, height: number = 5) => {
	let message = "";
	
	// if the warning/error is from the compiler, pretty print it
	if(filename){
		message += filename + "\n\n";
	}

	const preError = content.substring(0, start);
	const length = (end ?? start + 1) - start;
	const preLines = preError.split("\n"); 
	preLines.pop(); // get the lines before the location

	const startLine = preLines.length; 
	const lines = content.split("\n");
	const line = lines[startLine].replaceAll("\t", " ");
	// get the index of the start of the line.
	const lineStart = preLines.reduce((acc, val) => acc + val.length, 0) + preLines.length; // add back the new line characters
	const lineCountLength = startLine.toString().length;
	const baseColumn = (start - lineStart + lineCountLength + 2);
	const startColumn = (baseColumn % MAX_WIDTH);
	const locOverflowLine = Math.floor((baseColumn + length) / MAX_WIDTH) + 1;

	// print the lines before the location
	for(let i = Math.max(0, startLine - height); i < startLine; i++){
		let warnLine = i.toString().padStart(lineCountLength, " ");
		warnLine += " |";
		warnLine += lines[i].replaceAll("\t", " ");
		message += overflowLine(warnLine) + "\n";
	}	

	// print the line with the location
	let locLine = startLine.toString();
	locLine += " |";
	locLine += line;
	message += chunkSubstr(locLine, locOverflowLine) + "\n";
	// mark the location 
	message += " ".repeat(Math.max(startColumn, 0));
	message += "^".repeat(length);
	message += "\n";

	return {
		text: message,
		startColumn: startColumn + (length / 2)
	};
};

export const printBelow = (message: string, index: number) => {
	const lines = message.split("\n");
	const aligned = lines.map((line) => {
		const startPadding = Math.floor(index - (line.length / 2));
		if(startPadding + line.length >= MAX_WIDTH){
			return line;
		}
		return line.padStart(startPadding + line.length, " ");
	});
	return aligned.join("\n");
}

export const prettyMessage = (filename: string|undefined, content: string, info: Info) => {
	let message = info.message;
	
	message += "\n\n";
	const {text, startColumn} = printLocation(filename, content, info.start, info.end);
	message += text;
		
	// print warning/error details centered in the warning/error range
	if(info.detail){
		message += printBelow(info.detail, startColumn);
	}

	return message;
}