const fs = require('fs');
const path = '/tmp/alex-erp-repair/apps/web/src/components/study-studio/ImportantQuestionsTab.tsx';
const content = fs.readFileSync(path, 'utf8');

const oldStr = `            </div>
            
            {!iqSubjectId && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Create New Subject</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Subject Name *</Label>
                    <Input placeholder="e.g., Engineering Physics" value={iqNewSubjectName} onChange={e => setIqNewSubjectName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject Code *</Label>
                    <Input placeholder="e.g., PHY101" value={iqNewSubjectCode} onChange={e => setIqNewSubjectCode(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Semester</Label>
                    <Input placeholder="e.g., Semester 1" value={iqSemester} onChange={e => setIqSemterm(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <Input placeholder="e.g., 2023-2024" value={iqAcademicYear} onChange={e => setIqAcademicYear(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end pt-4">`;

const newStr = `            </div>
            
            {iqSubjectId ? null : (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Create New Subject</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Subject Name *</Label>
                    <Input placeholder="e.g., Engineering Physics" value={iqNewSubjectName} onChange={e => setIqNewSubjectName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject Code *</Label>
                    <Input placeholder="e.g., PHY101" value={iqNewSubjectCode} onChange={e => setIqNewSubjectCode(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Semester</Label>
                    <Input placeholder="e.g., Semester 1" value={iqSemester} onChange={e => setIqSemester(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <Input placeholder="e.g., 2023-2024" value={iqAcademicYear} onChange={e => setIqAcademicYear(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end pt-4">`;

const content = fs.readFileSync('/tmp/alex-erp-repair/apps/web/src/components/study-studio/ImportantQuestionsTab.tsx', 'utf8');
if (content.includes(oldStr)) {
  const newContent = content.replace(oldStr, newStr);
  fs.writeFileSync('/tmp/alex-erp-repair/apps/web/src/components/study-studio/ImportantQuestionsTab.tsx', newStr, 'utf8');
  console.log('Replacement done!');
} else {
  console.log('Old string not found!');
  // Debug: find the actual content
  const idx = content.indexOf('{!iqSubjectId && (');
  if (idx !== -1) {
    console.log('Found at index:', idx);
    console.log('Context:', content.substring(idx - 50, idx + 500));
  }
}