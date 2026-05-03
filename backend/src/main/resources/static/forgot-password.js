/**
 * Forgot-password page: (1) verify email + userID via /auth/forgot/verify-user,
 * (2) show security questions (static list), (3) on correct answer show new-password form,
 * (4) validate password rules then POST /auth/forgot/reset-password.
 */
const API_BASE_URL = "http://localhost:8080";

const passForm = document.getElementById('passForm');
const errorText = document.getElementById('error-text');
const credentialsForm = document.getElementById('credentials-form');
const securityQuestionForm = document.getElementById('security-question-form');
const newPasswordForm = document.getElementById('new-password-form');

passForm.addEventListener('submit', async function(event) {
  event.preventDefault();

  if (!credentialsForm.classList.contains('hidden')) {
    await credentialsLogic();
  } else if (!securityQuestionForm.classList.contains('hidden')) {
    securityQuestionLogic();
  } else {
    const newPassword = document.getElementById('new-password').value;

        const result = checkPassword(newPassword);

        if(result.isValid) {
            console.log("Password Valid");
            // API call for password change
            await resetPassword(newPassword);

        }
        else{
            console.log("Password Invalid");

            errorText.innerText = "Password does not meet criteria."
            errorText.classList.remove('hidden');
            document.getElementById("new-password").value = '';

        }


    }






});

    async function credentialsLogic(){

        const userData = {
            email: document.getElementById('forgotEmail').value,
            userID: document.getElementById('userID').value
        };

        try{
            const res = await fetch(`${API_BASE_URL}/auth/forgot/verify-user`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            const text = await res.text();

            if(res.ok){

                errorText.classList.add('hidden');
                console.log("Success");


                credentialsForm.classList.add('hidden');
                securityQuestionForm.classList.remove('hidden');

                const questions = ["What city were you born in", "Name of first pet", "Mothers maiden name"]; //Still static for this project
                populateSecurityQuestions(questions);
            }
            else{
                errorText.innerHTML = text || "Email or UserID is incorrect.";
                errorText.classList.remove('hidden');
                console.log("Error");
                passForm.reset();
                document.getElementById("forgotEmail").focus();
            }
        } catch(e){
            console.error(e);
            errorText.innerHTML = "Could not reach backend. Make sure the server is running on port 8080.";
            errorText.classList.remove('hidden');
        }

    }

    function populateSecurityQuestions(questions){

        const questionList = document.getElementById("security-question-list");

        questions.forEach((questionText, index) => {
            const option = document.createElement('option');

            option.text = questionText;
            option.value = index; //returns the index as a string instead of the question string
            questionList.appendChild(option);
        })

    }

    function securityQuestionLogic(){

        const securityQuestion = {
            question: document.getElementById('security-question-list').value,
            answer: document.getElementById('security-question-answer').value
        };

        //Temp hardcode
        let valid = false;
        if(securityQuestion.question === "0" && securityQuestion.answer === 'city'){
            valid = true;
        }
        else if(securityQuestion.question === "1" && securityQuestion.answer === 'pet'){
            valid = true;
        }
        else if(securityQuestion.question === "2" && securityQuestion.answer === 'maiden'){
            valid = true;
        }


        //API call to check if answer is true or false
        if(valid){
            console.log("Security question correct");

            errorText.classList.add('hidden');
            securityQuestionForm.classList.add('hidden');
            newPasswordForm.classList.remove('hidden');
            document.getElementById('password-criteria').classList.remove('hidden');
        }
        else{
            console.log("Security question wrong");

            errorText.innerHTML = "Incorrect answer.";
            errorText.classList.remove('hidden');
            document.getElementById("security-question-answer").value = "";

        }


    }

    function checkPassword(password){

        const startsWithLetter = /^[a-zA-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const isLongEnough = password.length >= 8;

        return{
            isValid: startsWithLetter && hasNumber && hasSpecialChar && isLongEnough,
            checks: {startsWithLetter, hasNumber, hasSpecialChar, isLongEnough}
        };

    }

    async function resetPassword(newPassword){

        const userData = {
            email: document.getElementById('forgotEmail').value,
            userID: document.getElementById('userID').value,
            newPassword: newPassword
        };

        try{
            const res = await fetch(`${API_BASE_URL}/auth/forgot/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData)
            });

            const text = await res.text();

            if(res.ok){
                errorText.classList.add('hidden');
                alert(text || "Password reset successfully. Please log in with your new password.");
                window.location.replace("index.html");
            }
            else{
                errorText.innerHTML = text || "Unable to reset password.";
                errorText.classList.remove('hidden');
            }

        } catch(e){
            console.error(e);
            errorText.innerHTML = "Could not reach backend. Make sure the server is running on port 8080.";
            errorText.classList.remove('hidden');
        }
    }