let globalDiffFile = '';
let oldTreeText = '';
let newTreeText = '';
let delArray = [];
let delMoveArray = [];
let updArray = [];
let cache = '<cache></cache>'


function getDomPath(el) {
    var stack = [];
    while (el.parentNode != null) {
        var sibCount = 0;
        var sibIndex = 0;
        for (var i = 0; i < el.parentNode.childNodes.length; i++) {
            var sib = el.parentNode.childNodes[i];
            if (sib.nodeName == el.nodeName) {
                if (sib === el) {
                    sibIndex = sibCount;
                    break;
                }
                sibCount++;
            }

        }
        if (el.hasAttribute('id') && el.id != '') {
            stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
        } else if (sibCount > 1) {
            stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
        } else {
            stack.unshift(el.nodeName.toLowerCase());
        }
        el = el.parentNode;
    }
    return stack.slice(4).join(' > '); // removes the html element
}

function createBibliography() {
    const colors = ['#87DEB3', '#92ceec', '#e3e372', '#FA9D9D', '#7eb3cd'];
    const explanations = [
        'Color 1 represents: Explanation 1',
        'Color 2 represents: Explanation 2',
        'Color 3 represents: Explanation 3',
        'Color 4 represents: Explanation 4',
        'Color 5 represents: Explanation 5'
    ];

    const table = document.createElement('table');

    for (let i = 0; i < 5; i++) {
        const row = document.createElement('tr');

        // Create the color stripe cell
        const colorCell = document.createElement('td');
        colorCell.style.backgroundColor = colors[i];
        colorCell.style.width = '20px'; // Adjust the width as needed
        row.appendChild(colorCell);

        // Create the explanation cell
        const explanationCell = document.createElement('td');
        explanationCell.textContent = explanations[i];
        row.appendChild(explanationCell);

        table.appendChild(row);
    }

    // Add the table to the 'diffOutput' div (upper right corner)
    const diffOutputDiv = document.getElementById('bibliography');
    diffOutputDiv.appendChild(table);
}

function uploadTrees() {
    const fileInput1 = document.getElementById('fileInput1');
    const fileInput2 = document.getElementById('fileInput2');
    const files1 = fileInput1.files;
    const files2 = fileInput2.files;

    if (files1.length !== 1 || files2.length !== 1) {
        alert('Please select exactly 2 XML files');
        return;
    }

    const reader1 = new FileReader();
    const reader2 = new FileReader();

    let promise = new Promise((resolve, reject) => {
        reader1.onload = function (event) {
            const content1 = event.target.result;
            reader2.readAsText(files2[0]);
            let promise2 = new Promise(resolve2 => {
                reader2.onload = function (event) {
                    const content2 = event.target.result;

                    // Combine the contents with '&'
                    const combinedContent = content1.trim() + '&' + content2.trim();
                    oldTreeText = content1;
                    newTreeText = content2;

                    // Send the combined content to the backend server
                    new Promise(resolve => {
                        sendTreesToServer(combinedContent, resolve)
                    }).then(() => resolve2());
                }
            })

            promise2.then(() => resolve());
        }
    })
    reader1.readAsText(files1[0]);
    return promise;
}

// Function to send the process trees to the backend server
function sendTreesToServer(content, resolve) {
    const url = new URL("http://localhost:3000")
    fetch('/cpeediff/diff', {
        headers: {
            'Content-Type': 'text/xml'
        },
        method: 'POST',
        body: content
    })
        .then(response => response.text())
        .then(diffFile => {
            globalDiffFile = diffFile;
            // Display the diff file
            displayDiffFile(diffFile);
            resolve();
        })
        .catch(error => {
            console.error('Error:', error);
            // Handle error if necessary
        });
}

// Function to display the diff file on the webpage
function displayDiffFile(diffFile) {
    const diffOutput = document.getElementById('diffOutput');
    diffOutput.textContent = diffFile;
}

function displayTrees() {
    uploadTrees().then(() => {
        displayBothTrees(oldTreeText, '#oldTree', '#graphcanvas1', newTreeText, '#newTree', '#graphcanvas2')
    });
}

function displayBothTrees(oldTreeXML, oldDivId, oldSvgId, newTreeXML, newDivId, newSvgId) {
    var parser, oldXmlDoc, newXmlDoc, cache;
    parser = new DOMParser();
    oldXmlDoc = parser.parseFromString(oldTreeXML, "text/xml");
    removeCommentsFromXmlDoc(oldXmlDoc);
    newXmlDoc = parser.parseFromString(newTreeXML, "text/xml");
    removeCommentsFromXmlDoc(newXmlDoc);
    cache = parser.parseFromString(cache, "text/xml");
    let insertsArray = new Map();
    let deleteArray = new Map();
    let moveOldArray = new Map();
    let moveNewArray = new Map();
    let updateArray = new Map();

    const diffDoc = parser.parseFromString(globalDiffFile, "text/xml");
    const diffElements = diffDoc.getElementsByTagName("*");
    /*Double Arrays: First index indicates the depth at which the new empty element has been added
     Second index indicates the index, at which the new element has been added
     */
    let indexAdjustmentOldTree = [[0]];
    let indexAdjustmentNewTree = [[0]];

    let indexAdjustmentForEmptyElementsOfDelete = [[0]];
    let indexAdjustmentForDeleteFutureMoves = [[0]];
    let indexAdjustmentForMoveFutureMoves = [[0]];


    let indexAdjustmentForMoveInsertEmptyNewTree = [[0]];
    let indexAdjustmentForMoveInsertEmptyOldTree = [[0]];

    for (let i = 0; i < diffElements.length; i++) {
        const diffElement = diffElements[i];
        if (diffElement.tagName === "move") {
            const newPath = diffElement.getAttribute("newPath");
            const oldPath = diffElement.getAttribute("oldPath");
            if (newPath) {
                const newPathArray = newPath.split("/").map(Number);
                if (!indexAdjustmentForDeleteFutureMoves[newPathArray.length - 1]) {
                    indexAdjustmentForDeleteFutureMoves[newPathArray.length - 1] = [0];
                }
                if (!indexAdjustmentForMoveFutureMoves[newPathArray.length - 1]) {
                    indexAdjustmentForMoveFutureMoves[newPathArray.length - 1] = [0];
                }
                // +1 because delete happens before it and if both are the same value then delete should not be affected
                if (!indexAdjustmentForDeleteFutureMoves[newPathArray.length - 1][newPathArray[newPathArray.length - 1] + 1]) {
                    indexAdjustmentForDeleteFutureMoves[newPathArray.length - 1][newPathArray[newPathArray.length - 1] + 1] = 2;
                } else {
                    indexAdjustmentForDeleteFutureMoves[newPathArray.length - 1][newPathArray[newPathArray.length - 1] + 1] += 2;
                }
                if (!indexAdjustmentForMoveFutureMoves[newPathArray.length - 1][newPathArray[newPathArray.length - 1] + 1]) {
                    indexAdjustmentForMoveFutureMoves[newPathArray.length - 1][newPathArray[newPathArray.length - 1] + 1] = 2;
                } else {
                    indexAdjustmentForMoveFutureMoves[newPathArray.length - 1][newPathArray[newPathArray.length - 1] + 1] += 2;
                }
            }
            if (oldPath) {
                const oldPathArray = oldPath.split("/").map(Number);
                if (!indexAdjustmentForDeleteFutureMoves[oldPathArray.length - 1]) {
                    indexAdjustmentForDeleteFutureMoves[oldPathArray.length - 1] = [0];
                }
                if (!indexAdjustmentForDeleteFutureMoves[oldPathArray.length - 1][oldPathArray[oldPathArray.length - 1]]) {
                    indexAdjustmentForDeleteFutureMoves[oldPathArray.length - 1][oldPathArray[oldPathArray.length - 1]] = -2
                } else {
                    indexAdjustmentForDeleteFutureMoves[oldPathArray.length - 1][oldPathArray[oldPathArray.length - 1]] -= 2;
                }
            }
        }
    }

    for (let i = 0; i < diffElements.length; i++) {
        const diffElement = diffElements[i];
        if (diffElement.tagName === "insert") {
            const newPath = diffElement.getAttribute("newPath");
            const newLabel = diffElement.querySelector("label");
            const elementId = diffElement.childNodes[1].getAttribute("id");

            if (newLabel) {
                insertsArray.set(elementId, true);
            } else {
                insertsArray.set(elementId, false);
            }

            if (newPath) {
                const newPathArray = newPath.split("/").map(Number);

                let currentNode = oldXmlDoc.getRootNode().childNodes[0];
                for (let j = 1; j < newPathArray.length; j++) {
                    while (currentNode.childNodes.length <= 2 * newPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        currentNode.appendChild(commentElement);
                        currentNode.appendChild(textElement)
                    }
                    currentNode = currentNode.childNodes[2 * newPathArray[j] + 1];
                }


                const necessaryEmpties = necessaryEmptyCount(diffElement.childNodes[1]);
                if (!indexAdjustmentOldTree[newPathArray.length - 1]) {
                    indexAdjustmentOldTree[newPathArray.length - 1] = [0]
                }
                if (!indexAdjustmentOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]]) {
                    indexAdjustmentOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]] = 2 * necessaryEmpties - 2;
                } else {
                    indexAdjustmentOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]] += 2 * necessaryEmpties - 2;
                }

                for (let i = 0; i < necessaryEmpties; i++) {
                    const emptyElement = cache.createElement("empty");
                    const textElement = cache.createTextNode("\n    ");
                    emptyElement.setAttribute('id', elementId);
                    currentNode.parentNode.insertBefore(emptyElement, currentNode);
                    currentNode.parentNode.insertBefore(textElement, currentNode);
                }
            }
        }
        if (diffElement.tagName === "delete") {
            const oldPath = diffElement.getAttribute("oldPath");
            let depth = 0;
            if (oldPath) {
                const oldPathArray = oldPath.split("/").map(Number);

                let originNode = oldXmlDoc.getRootNode().childNodes[0];
                let currentNode = newXmlDoc.getRootNode().childNodes[0];

                for (let j = 1; j < oldPathArray.length; j++) {

                    let indexAdjustmentCurrentStep = 0;
                    let indexAdjustmentOriginTree = 0;

                    if (!indexAdjustmentForEmptyElementsOfDelete[depth + 1]) {
                        indexAdjustmentForEmptyElementsOfDelete[depth + 1] = [0];
                    }
                    if (!indexAdjustmentForDeleteFutureMoves[depth + 1]) {
                        indexAdjustmentForDeleteFutureMoves[depth + 1] = [0];
                    }
                    if (!indexAdjustmentOldTree[depth + 1]) {
                        indexAdjustmentOldTree[depth + 1] = [0]
                    }
                    if (!indexAdjustmentNewTree[depth + 1]) {
                        indexAdjustmentNewTree[depth + 1] = [0]
                    }
                    for (let z = 0; z <= oldPathArray[j]; z++) {
                        if (!indexAdjustmentForEmptyElementsOfDelete[depth + 1][z]) {
                            indexAdjustmentForEmptyElementsOfDelete[depth + 1][z] = 0;
                        }
                        if (!indexAdjustmentForDeleteFutureMoves[depth + 1][z]) {
                            indexAdjustmentForDeleteFutureMoves[depth + 1][z] = 0;
                        }
                        if (!indexAdjustmentOldTree[depth + 1][z]) {
                            indexAdjustmentOldTree[depth + 1][z] = 0;
                        }
                        if (!indexAdjustmentNewTree[depth + 1][z]) {
                            indexAdjustmentNewTree[depth + 1][z] = 0;
                        }
                        indexAdjustmentOriginTree += indexAdjustmentForEmptyElementsOfDelete[depth + 1][z] + indexAdjustmentOldTree[depth + 1][z];
                        indexAdjustmentCurrentStep += indexAdjustmentForEmptyElementsOfDelete[depth + 1][z] + indexAdjustmentForDeleteFutureMoves[depth + 1][z] + indexAdjustmentNewTree[depth + 1][z];

                    }

                    while (currentNode.childNodes.length <= indexAdjustmentCurrentStep + 2 * oldPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        currentNode.appendChild(commentElement);
                        currentNode.appendChild(textElement)
                    }
                    currentNode = currentNode.childNodes[indexAdjustmentCurrentStep + 2 * oldPathArray[j] + 1];

                    while (originNode.childNodes.length <= indexAdjustmentOriginTree + 2 * oldPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        originNode.appendChild(commentElement);
                        originNode.appendChild(textElement);
                    }
                    originNode = originNode.childNodes[indexAdjustmentOriginTree + 2 * oldPathArray[j] + 1];

                    depth += 1;
                }
                let elementId = originNode.getAttribute("id");
                deleteArray.set(elementId, true);

                const necessaryEmpties = necessaryEmptyCount(originNode);
                if (!indexAdjustmentNewTree[oldPathArray.length - 1]) {
                    indexAdjustmentNewTree[oldPathArray.length - 1] = [0]
                }
                if (!indexAdjustmentNewTree[oldPathArray.length - 1][oldPathArray[oldPathArray.length - 1]]) {
                    indexAdjustmentNewTree[oldPathArray.length - 1][oldPathArray[oldPathArray.length - 1]] = 2 * necessaryEmpties - 2;
                } else {
                    indexAdjustmentNewTree[oldPathArray.length - 1][oldPathArray[oldPathArray.length - 1]] += 2 * necessaryEmpties - 2;
                }

                for (let i = 0; i < necessaryEmpties; i++) {
                    const emptyElement = cache.createElement("empty");
                    const textElement = cache.createTextNode("\n    ");
                    emptyElement.setAttribute('id', elementId);
                    currentNode.parentNode.insertBefore(emptyElement, currentNode);
                    currentNode.parentNode.insertBefore(textElement, currentNode);
                }

                indexAdjustmentForEmptyElementsOfDelete[depth][oldPathArray[oldPathArray.length - 1]] += 2;

            }
        }
        if (diffElement.tagName === "move") {
            const oldPath = diffElement.getAttribute("oldPath");
            const newPath = diffElement.getAttribute("newPath");
            let elementId;
            let node;
            let depthOld = 0;
            let depthNew = 0;

            if (oldPath) {

                const oldPathArray = oldPath.split("/").map(Number);

                if (newPath) {
                    const newPathArray = newPath.split("/").map(Number);
                    if (newPathArray > oldPathArray) {
                        if (!indexAdjustmentForMoveInsertEmptyOldTree[newPathArray.length - 1]) {
                            indexAdjustmentForMoveInsertEmptyOldTree[newPathArray.length - 1] = [0];
                        }
                        if (!indexAdjustmentForMoveInsertEmptyOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]]) {
                            indexAdjustmentForMoveInsertEmptyOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]] = 2;
                        } else {
                            indexAdjustmentForMoveInsertEmptyOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]] += 2;
                        }

                    }
                }

                let originNode = oldXmlDoc.getRootNode().childNodes[0];
                let currentNode = newXmlDoc.getRootNode().childNodes[0];


                for (let j = 1; j < oldPathArray.length; j++) {
                    let indexAdjustmentCurrentStep = 0;
                    let indexAdjustmentOriginStep = 0;


                    if (!indexAdjustmentForMoveInsertEmptyNewTree[depthOld + 1]) {
                        indexAdjustmentForMoveInsertEmptyNewTree[depthOld + 1] = [0];
                    }
                    if (!indexAdjustmentForEmptyElementsOfDelete[depthOld + 1]) {
                        indexAdjustmentForEmptyElementsOfDelete[depthOld + 1] = [0];
                    }
                    if (!indexAdjustmentOldTree[depthOld + 1]) {
                        indexAdjustmentOldTree[depthOld + 1] = [0];
                    }
                    if (!indexAdjustmentNewTree[depthOld + 1]) {
                        indexAdjustmentNewTree[depthOld + 1] = [0];
                    }
                    if (!indexAdjustmentForMoveFutureMoves[depthOld + 1]) {
                        indexAdjustmentForMoveFutureMoves[depthOld + 1] = [0];
                    }

                    for (let z = 0; z <= oldPathArray[j]; z++) {
                        if (!indexAdjustmentForMoveInsertEmptyNewTree[depthOld + 1][z]) {
                            indexAdjustmentForMoveInsertEmptyNewTree[depthOld + 1][z] = 0;
                        }
                        if (!indexAdjustmentForEmptyElementsOfDelete[depthOld + 1][z]) {
                            indexAdjustmentForEmptyElementsOfDelete[depthOld + 1][z] = 0;
                        }
                        if (!indexAdjustmentOldTree[depthOld + 1][z]) {
                            indexAdjustmentOldTree[depthOld + 1][z] = 0;
                        }
                        if (!indexAdjustmentNewTree[depthOld + 1][z]) {
                            indexAdjustmentNewTree[depthOld + 1][z] = 0;
                        }
                        if (!indexAdjustmentForMoveFutureMoves[depthOld + 1][z]) {
                            indexAdjustmentForMoveFutureMoves[depthOld + 1][z] = 0;
                        }

                        indexAdjustmentCurrentStep += indexAdjustmentForMoveInsertEmptyNewTree[depthOld + 1][z] + indexAdjustmentForEmptyElementsOfDelete[depthOld + 1][z] + indexAdjustmentNewTree[depthOld + 1][z] + indexAdjustmentForMoveFutureMoves[depthOld + 1][z];
                        indexAdjustmentOriginStep += indexAdjustmentForMoveInsertEmptyNewTree[depthOld + 1][z] + indexAdjustmentForEmptyElementsOfDelete[depthOld + 1][z] + indexAdjustmentOldTree[depthOld + 1][z];
                    }
                    indexAdjustmentCurrentStep += indexAdjustmentForMoveFutureMoves[depthOld + 1][oldPathArray[j]]

                    while (currentNode.childNodes.length <= indexAdjustmentCurrentStep + 2 * oldPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        currentNode.appendChild(commentElement);
                        currentNode.appendChild(textElement)
                    }
                    currentNode = currentNode.childNodes[indexAdjustmentCurrentStep + 2 * oldPathArray[j] + 1];

                    while (originNode.childNodes.length <= indexAdjustmentOriginStep + 2 * oldPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        originNode.appendChild(commentElement);
                        originNode.appendChild(textElement);
                    }
                    originNode = originNode.childNodes[indexAdjustmentOriginStep + 2 * oldPathArray[j] + 1];

                    depthOld += 1;
                }

                let movedFrom = "";

                if (newPath) {
                    const newPathArray = newPath.split("/").map(Number);
                    if (newPathArray > oldPathArray) {
                        // movedFrom = "⬆️";
                        movedFrom = "&#11014;&#65039;";
                    } else if (newPathArray < oldPathArray) {
                        // movedFrom = "⬇️";
                        movedFrom = "&#11015;&#65039;";
                    } else {
                        // movedFrom = "↔️";
                        movedFrom = "&#8596;&#65039;";
                    }
                }
                elementId = originNode.getAttribute("id");
                node = originNode;

                moveOldArray.set(elementId, movedFrom);
                moveNewArray.set(elementId, movedFrom)

                const necessaryEmpties = necessaryEmptyCount(originNode);
                if (!indexAdjustmentNewTree[oldPathArray.length - 1]) {
                    indexAdjustmentNewTree[oldPathArray.length - 1] = [0]
                }
                if (!indexAdjustmentNewTree[oldPathArray.length - 1][oldPathArray[oldPathArray.length - 1]]) {
                    indexAdjustmentNewTree[oldPathArray.length - 1][oldPathArray[oldPathArray.length - 1]] = 2 * necessaryEmpties - 2;
                } else {
                    indexAdjustmentNewTree[oldPathArray.length - 1][oldPathArray[oldPathArray.length - 1]] += 2 * necessaryEmpties - 2;
                }

                for (let i = 0; i < necessaryEmpties; i++) {
                    const emptyElement = cache.createElement("empty");
                    const textElement = cache.createTextNode("\n    ");
                    emptyElement.setAttribute('id', elementId);
                    currentNode.parentNode.insertBefore(emptyElement, currentNode);
                    currentNode.parentNode.insertBefore(textElement, currentNode);
                }

                indexAdjustmentForMoveInsertEmptyNewTree[depthOld][oldPathArray[oldPathArray.length - 1]] += 2;
            }
            if (newPath && oldPath) {
                const newPathArray = newPath.split("/").map(Number);
                indexAdjustmentForMoveFutureMoves[newPathArray.length - 1][newPathArray[newPathArray.length - 1]] = 0;


                let originNode = oldXmlDoc.getRootNode().childNodes[0];

                for (let j = 1; j < newPathArray.length; j++) {
                    let indexAdjustmentOriginStep = 0;


                    if (!indexAdjustmentForMoveInsertEmptyOldTree[depthNew + 1]) {
                        indexAdjustmentForMoveInsertEmptyOldTree[depthNew + 1] = [0];
                    }
                    if (!indexAdjustmentForEmptyElementsOfDelete[depthNew + 1]) {
                        indexAdjustmentForEmptyElementsOfDelete[depthNew + 1] = [0];
                    }
                    if (!indexAdjustmentOldTree[depthNew + 1]) {
                        indexAdjustmentOldTree[depthNew + 1] = [0];
                    }

                    for (let z = 0; z <= newPathArray[j]; z++) {
                        if (!indexAdjustmentForMoveInsertEmptyOldTree[depthNew + 1][z]) {
                            indexAdjustmentForMoveInsertEmptyOldTree[depthNew + 1][z] = 0;
                        }
                        if (!indexAdjustmentForEmptyElementsOfDelete[depthNew + 1][z]) {
                            indexAdjustmentForEmptyElementsOfDelete[depthNew + 1][z] = 0;
                        }
                        if (!indexAdjustmentOldTree[depthNew + 1][z]) {
                            indexAdjustmentOldTree[depthNew + 1][z] = 0;
                        }
                        indexAdjustmentOriginStep += indexAdjustmentForMoveInsertEmptyOldTree[depthNew + 1][z] + indexAdjustmentForEmptyElementsOfDelete[depthNew + 1][z] + indexAdjustmentOldTree[depthNew + 1][z];

                    }

                    while (originNode.childNodes.length <= indexAdjustmentOriginStep + 2 * newPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        originNode.appendChild(commentElement);
                        originNode.appendChild(textElement);
                    }
                    originNode = originNode.childNodes[indexAdjustmentOriginStep + 2 * newPathArray[j] + 1];

                    depthNew += 1;
                }

                const necessaryEmpties = necessaryEmptyCount(node);
                if (!indexAdjustmentOldTree[newPathArray.length - 1]) {
                    indexAdjustmentOldTree[newPathArray.length - 1] = [0]
                }
                if (!indexAdjustmentOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]]) {
                    indexAdjustmentOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]] = 2 * necessaryEmpties - 2;
                } else {
                    indexAdjustmentOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]] += 2 * necessaryEmpties - 2;
                }

                for (let i = 0; i < necessaryEmpties; i++) {
                    const emptyElement = cache.createElement("empty");
                    const textElement = cache.createTextNode("\n    ");
                    emptyElement.setAttribute('id', elementId);
                    originNode.parentNode.insertBefore(emptyElement, originNode);
                    originNode.parentNode.insertBefore(textElement, originNode);
                }

                indexAdjustmentForMoveInsertEmptyOldTree[depthNew][newPathArray[newPathArray.length - 2]] += 2;

                const oldPathArray = oldPath.split("/").map(Number);
                if (newPathArray > oldPathArray) {
                    indexAdjustmentForMoveInsertEmptyOldTree[newPathArray.length - 1][newPathArray[newPathArray.length - 1]] -= 2;
                }

            }
        }
        if (diffElement.tagName === "update") {
            const oldPath = diffElement.getAttribute("oldPath");
            let depth = 0;

            if (oldPath) {

                const oldPathArray = oldPath.split("/").map(Number);

                let originNode = oldXmlDoc.getRootNode().childNodes[0];
                for (let j = 1; j < oldPathArray.length; j++) {

                    let indexAdjustmentOriginStep = 0;

                    if (!indexAdjustmentOldTree[depth + 1]) {
                        indexAdjustmentOldTree[depth + 1] = [0];
                    }
                    for (let z = 0; z <= oldPathArray[j]; z++) {
                        if (!indexAdjustmentOldTree[depth + 1][z]) {
                            indexAdjustmentOldTree[depth + 1][z] = 0;
                        }
                        indexAdjustmentOriginStep += indexAdjustmentOldTree[depth + 1][z];
                    }

                    while (originNode.childNodes.length <= indexAdjustmentOriginStep + 2 * oldPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        originNode.appendChild(commentElement);
                        originNode.appendChild(textElement)
                    }
                    if (originNode.childNodes[indexAdjustmentOriginStep + 2 * oldPathArray[j] + 1].tagName === "parameters" || originNode.childNodes[2 * oldPathArray[j] + 1].tagName === "code") {
                        break;
                    }
                    originNode = originNode.childNodes[indexAdjustmentOriginStep + 2 * oldPathArray[j] + 1];
                    depth++;
                }
                console.log(originNode)
                let elementId = originNode.getAttribute("id");
                let children = diffElement.children;
                let stringWithHtmlUpdated = "";
                for (let i = 0; i < children.length; i++) {
                    stringWithHtmlUpdated += children[i].outerHTML;
                }
                updateArray.set(elementId, escapeHtml(stringWithHtmlUpdated));
            }
        }
    }

    displayOneTree(oldDivId, oldSvgId, oldXmlDoc, insertsArray, deleteArray, moveOldArray, moveNewArray, updateArray)
        .then(() => {
            displayOneTree(newDivId, newSvgId, newXmlDoc, insertsArray, deleteArray, moveOldArray, moveNewArray, updateArray).then(() => {
                document.getElementById("oldTree").innerHTML += "";
                document.getElementById("newTree").innerHTML += "";
            });
        })
        .catch((error) => {
            console.error(error);
        });
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function displayOneTree(divId, svgId, xmlDoc, insertsArray, deleteArray, moveOldArray, moveNewArray, updateArray) {
    return new Promise((resolve, reject) => {
        let graphrealization = new WfAdaptor('http://localhost/cockpit/themes/extended/theme.js', function (graphrealization) {

            graphrealization.draw_labels = function (max, labels, shift, striped) {
                // edit labels here
                //TODO Handle index -1 (Ursache: No element-id in loops)
                if (divId === "#newTree") {
                    updateArray.forEach((updateValue, id) => {
                        const index = labels.findIndex(label => label['element_id'] === id);
                        if (index != -1) {
                            var updated = {};
                            updated['column'] = 'Updated';
                            updated['value'] = updateValue;
                            labels[index]['label'].push(updated);
                        }
                    })
                    moveOldArray.forEach((movedFrom, id) => {
                        const index = labels.findIndex(label => label['element_id'] === id);
                        if (index != -1) {
                            var moved = {};
                            moved['column'] = 'MovedFrom';
                            moved['value'] = movedFrom;
                            labels[index]['label'].push(moved);
                        }
                    })
                }


                $(svgId).css('grid-row', '1/span ' + (max.row + 2));

                if (striped == true) {
                    if (!$(divId).hasClass('striped')) {
                        $(divId).addClass('striped');
                    }
                } else {
                    $(divId).removeClass('striped');
                }

                $(svgId + '.graphlabel, ' + divId + ' .graphempty, ' + divId + ' .graphlast').remove();
                var tlabels = {};
                var tcolumns = [];
                var tcolumncount = {}
                _.each(labels, function (val) {
                    if (val.label != "") {
                        tlabels[val.row] = [];
                        _.each(val.label, function (col) {
                            if (!tcolumns.includes(col.column)) {
                                tcolumns.push(col.column);
                                tcolumncount[col.column] = 0;
                            }
                            if (col.value != undefined) {
                                tcolumncount[col.column] += 1;
                            }
                            tlabels[val.row][tcolumns.indexOf(col.column)] = {
                                label: col.value,
                                type: val.tname,
                                id: val.element_id
                            };
                        });
                    }
                });
                $(divId).css({
                    'grid-template-rows': (shift / 2) + 'px repeat(' + max.row + ', 1fr) ' + (shift / 2) + 'px',
                    'grid-template-columns': 'max-content' + (tcolumns.length > 0 ? ' repeat(' + tcolumns.length.toString() + ',max-content)' : '') + ' auto'
                });
                for (var i = 0; i < max.row; i++) {
                    for (var j = 0; j < tcolumns.length; j++) {
                        if (tlabels[i + 1] != undefined && tlabels[i + 1][j] != undefined && tlabels[i + 1][j].label != undefined && tlabels[i + 1][j].label != '') {
                            var col = tlabels[i + 1][j];
                            var ele = $('<div element-row="' + i + '" class="graphlabel ' + (i % 2 == 0 ? 'odd' : 'even') + '" element-type="' + col.type + '" element-id="' + col.id + '" style="grid-column: ' + (j + 2) + '; grid-row: ' + (i + 2) + '"><span>' + col.label + '</span></div>');
                            graphrealization.illustrator.draw.bind_event(ele, col.type, false);
                            $(divId).append(ele);
                        } else {
                            if (tcolumncount[tcolumns[j]] != 0) {
                                var ele = $('<div element-row="' + i + '" class="graphempty ' + (i % 2 == 0 ? 'odd' : 'even') + '" style="grid-column: ' + (j + 2) + '; grid-row: ' + (i + 2) + '; padding-bottom: ' + shift + 'px">&#032;</div>');
                                $(divId).append(ele);
                            }
                        }
                    }
                    var j = tcolumns.length;
                    var ele = $('<div element-row="' + i + '" class="graphlast ' + (i % 2 == 0 ? 'odd' : 'even') + '" style="grid-column: ' + (j + 2) + '; grid-row: ' + (i + 2) + '; padding-bottom: ' + shift + 'px">&#032;</div>');
                    $(divId).append(ele);
                }

                var patternOdd = $('<pattern id="diagonalHatchOdd" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(135 0 0)" width="35">\n' +
                    '  <rect x="0" y="0" height="10" style="fill:#e3e372" width="35"></rect>\n' +
                    '  <line x1="0" y1="0" x2="0" y2="10" style="stroke:#92ceec; stroke-width:35"></line>\n' +
                    '</pattern>');
                var patternEven = $('<pattern id="diagonalHatchEven" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(135 0 0)" width="35">\n' +
                    '  <rect x="0" y="0" height="10" style="fill:#cdcd67" width="35"></rect>\n' +
                    '  <line x1="0" y1="0" x2="0" y2="10" style="stroke:#7eb3cd; stroke-width:35"></line>\n' +
                    '</pattern>');

                $(svgId).prepend(patternOdd);
                $(svgId).prepend(patternEven);

                if (divId === "#newTree") {
                    insertsArray.forEach((indexIsLabel, id) => {
                        let element = $(divId).find('[element-id=' + id + '][element-row]')
                        let row = element.last().attr('element-row');
                        let myclass = element.last().hasClass('odd') ? "diffaddodd" : "diffaddeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })

                    moveNewArray.forEach((indexIsLabel, id) => {
                        let element = $(divId).find('[element-id=' + id + '][element-row]')
                        let row = element.last().attr('element-row');
                        let myclass = element.last().hasClass('odd') ? "diffmoveodd" : "diffmoveeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })


                    updateArray.forEach((updateValue, id) => {
                        let element = $(divId).find('[element-id=' + id + '][element-row]')
                        let row = element.last().attr('element-row');
                        let myclass = element.last().hasClass('odd') ? "diffupdateodd" : "diffupdateeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })

                    delArray.forEach(element => {
                        let row = element.last().attr('element-row');
                        let myclass = element.last().hasClass('odd') ? "diffremoveodd" : "diffremoveeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })

                    delMoveArray.forEach(element => {
                        let row = element.last().attr('element-row');
                        let myclass = element.last().hasClass('odd') ? "diffmoveodd" : "diffmoveeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })
                    updArray.forEach(element => {
                        let row = element.last().attr('element-row');
                        let myclass = element.last().hasClass('odd') ? "diffupdateodd" : "diffupdateeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })
                }
                if (divId === "#oldTree") {
                    deleteArray.forEach((indexIsLabel, id) => {
                        let element = $(divId).find('[element-id=' + id + '][element-row]')
                        delArray.push(element)
                    })
                    moveOldArray.forEach((movedFrom, id) => {
                        let element = $(divId).find('[element-id=' + id + '][element-row]')
                        delMoveArray.push(element)
                    })
                    updateArray.forEach((updateValue, id) => {
                        let element = $(divId).find('[element-id=' + id + '][element-row]')
                        updArray.push(element)
                    })
                }
            };

            graphrealization.set_svg_container($(svgId));
            graphrealization.set_label_container($(divId));
            graphrealization.set_description($(xmlDoc), true);
            resolve();
        });
    });
}

function removeCommentsFromXmlDoc(xmlDoc) {
    var comments = xmlDoc.evaluate('//comment()', xmlDoc, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0; i < comments.snapshotLength; i++) {
        var commentNode = comments.snapshotItem(i);
        var textNode = commentNode.previousSibling;
        commentNode.parentNode.removeChild(textNode);
        commentNode.parentNode.removeChild(commentNode);
    }
}

function necessaryEmptyCount(node) {
    let count = 0;
    switch(node.nodeName) {
        case "loop":
            count += 2;
            for (let i = 0; i < node.children.length; i++) {
                count += necessaryEmptyCount(node.children[i]);
            }
            break;
        default:
            count += 1;
    }
    return count;
}

// style="fill:green;" for <recT>
