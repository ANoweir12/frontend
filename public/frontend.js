let globalDiffFile = '';
let oldTreeText = '';
let newTreeText = '';
let delArray = [];

function getDomPath(el) {
    var stack = [];
    while ( el.parentNode != null ) {
        var sibCount = 0;
        var sibIndex = 0;
        for ( var i = 0; i < el.parentNode.childNodes.length; i++ ) {
            var sib = el.parentNode.childNodes[i];
            if ( sib.nodeName == el.nodeName ) {
                if ( sib === el ) {
                    sibIndex = sibCount;
                    break;
                }
                sibCount++;
            }
        }
        if ( el.hasAttribute('id') && el.id != '' ) {
            stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
        } else if ( sibCount > 1 ) {
            stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
        } else {
            stack.unshift(el.nodeName.toLowerCase());
        }
        el = el.parentNode;
    }
    return stack.slice(4).join(' > '); // removes the html element
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
    newXmlDoc = parser.parseFromString(newTreeXML, "text/xml");
    cache = parser.parseFromString(cache, "text/xml");
    let insertsArray = new Map();
    let deleteArray = new Map();


    const diffDoc = parser.parseFromString(globalDiffFile, "text/xml");
    const diffElements = diffDoc.getElementsByTagName("*");
    let indexAdjustmentForNewTree = [0];
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

                const emptyElement = cache.createElement("empty");
                const textElement = cache.createTextNode("\n    ");

                let currentNode = oldXmlDoc.getRootNode().childNodes[0];
                for (let j = 1; j < newPathArray.length; j++) {
                    if (currentNode.childNodes.length <= 2 * newPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        currentNode.appendChild(commentElement);
                        currentNode.appendChild(textElement)
                    }
                    currentNode = currentNode.childNodes[2 * newPathArray[j] + 1];
                }

                emptyElement.setAttribute('id', elementId);

                currentNode.parentNode.insertBefore(emptyElement, currentNode);
                currentNode.parentNode.insertBefore(textElement, currentNode);
            }
        }
        if (diffElement.tagName === "delete") {
            const oldPath = diffElement.getAttribute("oldPath");
            let depth = 0;
            if (oldPath) {
                const oldPathArray = oldPath.split("/").map(Number);

                const emptyElement = cache.createElement("empty");
                const textElement = cache.createTextNode("\n    ");

                let originNode = oldXmlDoc.getRootNode().childNodes[0];
                let currentNode = newXmlDoc.getRootNode().childNodes[0];

                for (let j = 1; j < oldPathArray.length; j++) {
                    if (!indexAdjustmentForNewTree[depth + 1]) {
                        indexAdjustmentForNewTree[depth + 1] = 0;
                    }
                    if (currentNode.childNodes.length <= indexAdjustmentForNewTree[depth + 1] + 2 * oldPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        currentNode.appendChild(commentElement);
                        currentNode.appendChild(textElement)
                    }
                    currentNode = currentNode.childNodes[indexAdjustmentForNewTree[depth + 1] + 2 * oldPathArray[j] + 1];

                    if (originNode.childNodes.length <= indexAdjustmentForNewTree[depth + 1] + 2 * oldPathArray[j] + 1) {
                        const textElement = cache.createTextNode("\n    ");
                        const commentElement = cache.createComment("Placeholder");
                        originNode.appendChild(commentElement);
                        originNode.appendChild(textElement);
                    }
                    originNode = originNode.childNodes[indexAdjustmentForNewTree[depth + 1] + 2 * oldPathArray[j] + 1];

                    depth += 1;
                }
                let elementId = originNode.getAttribute("id");
                if (!originNode.getElementsByTagName("label").length) {
                    deleteArray.set(elementId, false);
                } else {
                    deleteArray.set(elementId, true);
                }
                emptyElement.setAttribute("id", originNode.getAttribute("id"));
                currentNode.parentNode.insertBefore(emptyElement, currentNode);
                currentNode.parentNode.insertBefore(textElement, currentNode);
                indexAdjustmentForNewTree[depth] += 2;

            }
        }
        // TODO: Add logic for other diffElements here
    }

    displayOneTree(oldDivId, oldSvgId, oldXmlDoc, insertsArray, deleteArray)
        .then(() => {
            return displayOneTree(newDivId, newSvgId, newXmlDoc, insertsArray, deleteArray);
        })
        .catch((error) => {
            console.error(error);
        });
}

function displayOneTree(divId, svgId, xmlDoc, insertsArray, deleteArray) {
    return new Promise((resolve, reject) => {
        let graphrealization = new WfAdaptor('http://localhost/cockpit/themes/extended/theme.js', function (graphrealization) {

            graphrealization.draw_labels = function (max, labels, shift, striped) {
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
                            var ele = $('<div element-row="'+i+'" class="graphlabel ' + (i % 2 == 0 ? 'odd' : 'even') + '" element-type="' + col.type + '" element-id="' + col.id + '" style="grid-column: ' + (j + 2) + '; grid-row: ' + (i + 2) + '"><span>' + col.label + '</span></div>');
                            graphrealization.illustrator.draw.bind_event(ele, col.type, false);
                            $(divId).append(ele);
                        } else {
                            if (tcolumncount[tcolumns[j]] != 0) {
                                var ele = $('<div element-row="'+i+'" class="graphempty ' + (i % 2 == 0 ? 'odd' : 'even') + '" style="grid-column: ' + (j + 2) + '; grid-row: ' + (i + 2) + '; padding-bottom: ' + shift + 'px">&#032;</div>');
                                $(divId).append(ele);
                            }
                        }
                    }
                    var j = tcolumns.length;
                    var ele = $('<div element-row="'+i+'" class="graphlast ' + (i % 2 == 0 ? 'odd' : 'even') + '" style="grid-column: ' + (j + 2) + '; grid-row: ' + (i + 2) + '; padding-bottom: ' + shift + 'px">&#032;</div>');
                    $(divId).append(ele);
                }
                if (divId === "#newTree") {
                    insertsArray.forEach((indexIsLabel, id) => {
                        let element = $(divId).find('[element-id=' + id + ']')
                        let row = element.last().attr('element-row');
                        let myclass = element.last().hasClass('odd') ? "diffaddodd" : "diffaddeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })

                    delArray.forEach(element => {
                        let row = element.last().attr('element-row');
                        let myclass = element.last().hasClass('odd') ? "diffremoveodd" : "diffremoveeven";
                        $(document).find('[element-row=' + row + ']').addClass(myclass);
                    })
                }
                if (divId === "#oldTree") {
                    deleteArray.forEach((indexIsLabel, id) => {
                        let element = $(divId).find('[element-id=' + id + ']')
                        delArray.push(element)
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



// style="fill:green;" for <recT>
