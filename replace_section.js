const fs = require("fs");
const path = "/tmp/alex-erp-repair/apps/web/src/app/(dashboard)/study-studio/StudyStudioContent.tsx";
const content = fs.readFileSync(path, "utf8");

const startIdx = content.indexOf("{/* IMPORTANT QUESTIONS TAB */}");
let depth = 0;
let inTabsContent = false;
let endIdx = -1;
for (let i = startIdx; i < content.length; i++) {
  if (content.startsWith("<TabsContent", i)) {
    inTabsContent = true;
    depth++;
  } else if (content.startsWith("</TabsContent>", i)) {
    if (inTabsContent) {
      depth--;
      if (depth === 0) {
        endIdx = i + "</TabsContent>".length;
        break;
      }
    }
  }
}

const newSection = `{/* IMPORTANT QUESTIONS TAB */}
        <TabsContent value="important-questions" className="mt-4 space-y-6">
          <ImportantQuestionsTab
            questionPapers={questionPapers}
            questionAnalyses={questionAnalyses}
            iqSubjects={iqSubjects}
            allUserDocuments={allUserDocuments?.documents || []}
          />
        </TabsContent>`;

const newContent = content.substring(0, startIdx) + newSection + content.substring(endIdx);
fs.writeFileSync(path, newContent, "utf8");
console.log("Replacement done!");