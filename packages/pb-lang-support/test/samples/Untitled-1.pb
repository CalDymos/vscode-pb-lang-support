; ---------------------------------------------------------------------------
; Outline test file for VS Code PureBasic extension
; Generates many symbols: modules, procedures, declares, structures, interfaces,
; enumerations, constants, globals and locals.
; ---------------------------------------------------------------------------

; --- Constants (with '=' + string suffix '$') ---
#CONST_NUM_01 = 1
#CONST_NUM_02 = 2
#CONST_NUM_03 = 3
#CONST_STR_01$ = "Hello"
#CONST_STR_02$ = "World"

; --- Globals (outside any module) ---
Global gCounter.i
Global *gPtr
Protected gFlag.i
Static gStaticValue.i

; --- Structure + members ---
Structure SPoint
  x.i
  y.i
  *next.SPoint
EndStructure

; --- Interface (simple) ---
Interface ITest
  DoWork(a.i)
  GetValue.i()
EndInterface

; --- Enumeration without name (common PureBasic style) ---
Enumeration
  #E_ANON_01
  #E_ANON_02
  #E_ANON_03
  #E_ANON_04
  #E_ANON_05
EndEnumeration

; --- Enumeration with name ---
Enumeration EColors
  #Color_Red
  #Color_Green
  #Color_Blue
EndEnumeration

; --- Module with procedures, locals, and declarations ---
Module ModAlpha

  Global modVar.i

  Declare.i AddValues(a.i, b.i)
  Declare.s MakeText(a.i)

  Procedure.i AddValues(a.i, b.i)
    Protected sum.i
    sum = a + b
    ProcedureReturn sum
  EndProcedure

  Procedure.s MakeText(a.i)
    Define txt.s
    txt = "Value: " + Str(a)
    ProcedureReturn txt
  EndProcedure

  Procedure TestLotsOfLocals()
    Protected i.i
    Protected j.i
    Define k.i
    Static s.i
    Dim arr.i(10)

    For i = 0 To 10
      j = i * 2
      k = j + 1
      s + 1
      arr(i) = k
    Next
  EndProcedure

EndModule

; --- Second module with many procedures (lots of symbols) ---
Module ModBeta

  Procedure Proc01()
  EndProcedure

  Procedure Proc02()
  EndProcedure

  Procedure Proc03()
  EndProcedure

  Procedure Proc04()
  EndProcedure

  Procedure Proc05()
  EndProcedure

  Procedure Proc06()
  EndProcedure

  Procedure Proc07()
  EndProcedure

  Procedure Proc08()
  EndProcedure

  Procedure Proc09()
  EndProcedure

  Procedure Proc10()
  EndProcedure

EndModule

; --- Top-level procedures (outside modules) ---
Procedure TopLevel01()
  Protected a.i
  a = 1
EndProcedure

Procedure TopLevel02()
  Protected b.i
  b = 2
EndProcedure

Procedure TopLevel03()
  Protected c.i
  c = 3
EndProcedure

; --- A bunch of constant definitions to stress the outline ---
#ITEM_001 = 1
#ITEM_002 = 2
#ITEM_003 = 3
#ITEM_004 = 4
#ITEM_005 = 5
#ITEM_006 = 6
#ITEM_007 = 7
#ITEM_008 = 8
#ITEM_009 = 9
#ITEM_010 = 10
#ITEM_011 = 11
#ITEM_012 = 12
#ITEM_013 = 13
#ITEM_014 = 14
#ITEM_015 = 15
#ITEM_016 = 16
#ITEM_017 = 17
#ITEM_018 = 18
#ITEM_019 = 19
#ITEM_020 = 20
