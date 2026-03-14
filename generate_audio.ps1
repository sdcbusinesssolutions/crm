Add-Type -AssemblyName System.Speech

$synth1 = New-Object -TypeName System.Speech.Synthesis.SpeechSynthesizer
$synth1.SetOutputToWaveFile('F:\prj4\wpcode\client\public\assets\demo_emi.wav')
$synth1.Speak('Hello, I am calling regarding your recent EMI payment. We noticed it is currently overdue. How would you like to proceed?')
$synth1.Dispose()

$synth2 = New-Object -TypeName System.Speech.Synthesis.SpeechSynthesizer
$synth2.SetOutputToWaveFile('F:\prj4\wpcode\client\public\assets\demo_appointment.wav')
$synth2.Speak('Hi there! I can help you book an appointment. What date and time are you looking for?')
$synth2.Dispose()

$synth3 = New-Object -TypeName System.Speech.Synthesis.SpeechSynthesizer
$synth3.SetOutputToWaveFile('F:\prj4\wpcode\client\public\assets\demo_banking.wav')
$synth3.Speak('Welcome to our online banking assistant. Please provide your customer ID to proceed with your secure transaction.')
$synth3.Dispose()

$synth4 = New-Object -TypeName System.Speech.Synthesis.SpeechSynthesizer
$synth4.SetOutputToWaveFile('F:\prj4\wpcode\client\public\assets\demo_support.wav')
$synth4.Speak('Thank you for contacting customer support. I am an AI assistant here to help you resolve your software issues quickly.')
$synth4.Dispose()
