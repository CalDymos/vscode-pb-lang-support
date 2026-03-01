; PureBasic basic syntax test file
; For testing various features of VSCode plugins

; Global variable declaration
Global window.i = 0
Global event.i = 0
Global message.s = "Hello, PureBasic!"

Global vrt.i, tzu.l, *pluf

; Data type test
Global integerVar.i = 42
Global stringVar.s = "Test String"
Global floatVar.f = 3.14159
Global longVar.l = 123456789
Global byteVar.b = 255

; Array test
Dim intArray.i(10)
Dim stringArray.s(5)

; Structure definition
Structure Person
    name.s
    age.i
    height.f
EndStructure

; Enumeration definition
Enumeration
    #STATE_IDLE
    #STATE_RUNNING
    #STATE_PAUSED
    #STATE_STOPPED
EndEnumeration

; Simple procedure definition
Procedure.i AddNumbers(a.i, b.i)
    ProcedureReturn a + b
EndProcedure

; Procedure with parameters
Procedure.s CreateGreeting(name.s, age.i)
    Static greeting.s
    greeting = "Hello, " + name + "! You are " + Str(age) + " years old."
    ProcedureReturn greeting
EndProcedure

; Procedure with return value
Procedure.f CalculateCircleArea(radius.f)
    Define area.f = #PI * radius * radius
    ProcedureReturn area
EndProcedure

; Conditional statement test
If integerVar > 0
    Debug "Positive number"
ElseIf integerVar < 0
    Debug "Negative number"
Else
    Debug "Zero"
EndIf

; Loop test
For i = 1 To 10
    intArray(i) = i * 2
Next i

; While loop
While window < 100
    window + 1
Wend

; Repeat loop
Repeat
    event + 1
Until event >= 5

; Select statement
Select integerVar
    Case 1
        Debug "Case 1"
    Case 2
        Debug "Case 2"
    Default
        Debug "Default case"
EndSelect

; Function call test
Debug AddNumbers(5, 3)
Debug CreateGreeting("Alice", 25)
Debug CalculateCircleArea(5.0)

; Built-in function test
Debug Str(integerVar)
Debug Val("123")
Debug Len(stringVar)
Debug Left(stringVar, 3)
Debug Right(stringVar, 3)
Debug Mid(stringVar, 2, 3)

; File operation test
If CreateFile(0, "test.txt")
    WriteStringN(0, "This is a test file")
    WriteStringN(0, "Created for testing PureBasic syntax")
    CloseFile(0)
EndIf

; Window creation test (if GUI is supported)
CompilerIf #PB_Compiler_Executable
    If OpenWindow(0, 0, 0, 400, 300, "Test Window", #PB_Window_SystemMenu | #PB_Window_ScreenCentered)
        TextGadget(0, 10, 10, 200, 20, "PureBasic Test")
        ButtonGadget(1, 10, 40, 100, 30, "Click Me")
        
        Repeat
            event = WaitWindowEvent()
            If event = #PB_Event_Gadget
                If EventGadget() = 1
                    MessageRequester("Info", "Button clicked!")
                EndIf
            EndIf
        Until event = #PB_Event_CloseWindow
        
        CloseWindow(0)
    EndIf
CompilerEndIf

Define per.person
; Test various syntax structures
With per
    \name = "John Doe"
    \age = 30
    \height = 1.75
EndWith

; List operations
NewList stringList.s()
AddElement(stringList())
stringList() = "First item"
AddElement(stringList())
stringList() = "Second item"

ForEach stringList()
    Debug stringList()
Next

; Error test (for testing diagnostic features)
; Intentionally write some problematic code

With Person ; variable Person has no structure
    \name = "John Doe"
    \age = 30
    \height = 1.75
EndWith
  
If integerVar > 0 Then ; Then is no valid operator
    Debug "This should trigger a warning"
EndIf

Procedure TestProcedure ; Missing parameter parentheses
    Debug "This should trigger a warning"
EndProcedure

; End
Debug "PureBasic test file completed!"