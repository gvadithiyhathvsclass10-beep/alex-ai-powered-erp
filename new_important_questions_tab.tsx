{/* IMPORTANT QUESTIONS TAB */}
        <TabsContent value="important-questions" className="mt-4 space-y-6">
          <ImportantQuestionsTab
            questionPapers={questionPapers}
            questionAnalyses={questionAnalyses}
            iqSubjects={iqSubjects}
            allUserDocuments={allUserDocuments?.documents || []}
          />
        </TabsContent>